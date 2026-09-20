CREATE OR REPLACE FUNCTION public.get_my_company() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select company_id from public.profiles where id = auth.uid() $function$;

CREATE OR REPLACE FUNCTION public.get_my_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT role FROM public.profiles WHERE id = auth.uid() $function$;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$function$;

CREATE OR REPLACE FUNCTION public.is_company_admin(p_company uuid DEFAULT NULL::uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select coalesce((select p.is_company_admin and p.company_id is not null
              and (p_company is null or p.company_id = p_company)
             from public.profiles p where p.id = auth.uid()), false)
     and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'))
$function$;

CREATE OR REPLACE FUNCTION public.is_assigned_store(p_store_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select public.is_admin() or exists (
    select 1 from public.store_supervisors ss
    where ss.store_id = p_store_id and ss.user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_session_participant(p_session_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select public.is_admin() or exists (
    select 1 from public.inventory_sessions s
    where s.id = p_session_id
      and s.company_id = public.get_my_company()
      and (s.created_by = auth.uid()
        or public.is_company_admin(s.company_id)
        or (s.status <> 'closed' and exists (
          select 1 from public.session_members sm
          where sm.session_id = s.id and sm.user_id = auth.uid()))));
$function$;

CREATE OR REPLACE FUNCTION public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_target_label text, p_details jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth'
AS $function$
declare v_label text;
begin
  select coalesce(nullif(btrim(pr.full_name), ''), u.email::text, '') into v_label
    from auth.users u left join public.profiles pr on pr.id = u.id where u.id = auth.uid();
  insert into public.admin_audit_log (actor_id, actor_label, action, target_type, target_id, target_label, details)
  values (auth.uid(), coalesce(v_label, ''), p_action, coalesce(p_target_type, ''),
          coalesce(p_target_id, ''), coalesce(p_target_label, ''), coalesce(p_details, '{}'::jsonb));
end; $function$;

CREATE OR REPLACE FUNCTION public.plafond_appareils(p_store_id uuid) RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_dec integer;
begin
  select coalesce(s.devices, case c.plan when 'essential' then 2 when 'advanced' then 20
             when 'enterprise' then 100 else null end)
    into v_dec from public.stores s join public.companies c on c.id = s.company_id where s.id = p_store_id;
  if v_dec is null or v_dec < 1 then return null; end if;
  if v_dec <= 2   then return 2;   end if;
  if v_dec <= 20  then return 20;  end if;
  if v_dec <= 100 then return 100; end if;
  return 100 + 10 * ceil((v_dec - 100) / 10.0)::integer;
end; $function$;

CREATE OR REPLACE FUNCTION public.prevenir_forfait_trop_juste(p_store_id uuid, p_plafond integer, p_besoin integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare repos constant interval := interval '30 days'; v_company uuid; v_nom text;
begin
  if exists (select 1 from public.notifications where type = 'forfait_trop_juste'
              and donnees ->> 'store_id' = p_store_id::text and created_at > now() - repos) then return; end if;
  select s.company_id, s.name into v_company, v_nom from public.stores s where s.id = p_store_id;
  if v_company is null then return; end if;
  insert into public.notifications (user_id, type, donnees)
  select p.id, 'forfait_trop_juste',
         jsonb_build_object('store_id', p_store_id::text, 'magasin', coalesce(v_nom, ''),
           'forfait', p_plafond::text, 'besoin', p_besoin::text)
    from public.profiles p where p.company_id = v_company and p.is_company_admin;
end; $function$;

CREATE OR REPLACE FUNCTION public.prendre_place_appareil(p_session_id uuid, p_appareil text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  fenetre constant interval := interval '90 seconds';
  v_store uuid; v_cle text; v_plafond integer; v_deja boolean; v_refuse boolean;
  v_actifs integer; v_besoin integer; v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  if not public.is_session_participant(p_session_id) then
    return jsonb_build_object('accorde', false, 'code', 'interdit'); end if;
  v_cle := btrim(coalesce(p_appareil, ''));
  if v_cle = '' or length(v_cle) > 64 or v_cle !~ '^[A-Za-z0-9._:-]+$' then
    return jsonb_build_object('accorde', false, 'code', 'cle_invalide'); end if;
  select s.store_id into v_store from public.inventory_sessions s where s.id = p_session_id;
  if v_store is null then return jsonb_build_object('accorde', false, 'code', 'introuvable'); end if;
  perform 1 from public.stores where id = v_store for update;
  delete from public.appareils_actifs where store_id = v_store and vu_le < now() - fenetre;
  v_plafond := public.plafond_appareils(v_store);
  select coalesce(bool_or(not refuse), false), coalesce(bool_or(refuse), false)
    into v_deja, v_refuse from public.appareils_actifs where store_id = v_store and appareil = v_cle;
  if not v_deja and v_plafond is not null then
    select count(*) into v_actifs from public.appareils_actifs where store_id = v_store and not refuse;
    if v_actifs >= v_plafond then
      if not v_refuse then
        insert into public.appareils_par_jour (store_id, jour, pic, refus) values (v_store, v_jour, 0, 1)
          on conflict (store_id, jour) do update set refus = appareils_par_jour.refus + 1;
        select a.pic + a.refus into v_besoin from public.appareils_par_jour a
         where a.store_id = v_store and a.jour = v_jour;
        begin perform public.prevenir_forfait_trop_juste(v_store, v_plafond, v_besoin);
        exception when others then null; end;
      end if;
      insert into public.appareils_actifs (store_id, appareil, vu_le, refuse) values (v_store, v_cle, now(), true)
        on conflict (store_id, appareil) do update set vu_le = now(), refuse = true;
      return jsonb_build_object('accorde', false, 'code', 'forfait_plein', 'plafond', v_plafond, 'appareils', v_actifs);
    end if;
  end if;
  insert into public.appareils_actifs (store_id, appareil, vu_le, refuse) values (v_store, v_cle, now(), false)
    on conflict (store_id, appareil) do update set vu_le = now(), refuse = false;
  select count(*) into v_actifs from public.appareils_actifs where store_id = v_store and not refuse;
  insert into public.appareils_par_jour (store_id, jour, pic, refus) values (v_store, v_jour, v_actifs, 0)
    on conflict (store_id, jour) do update set pic = greatest(appareils_par_jour.pic, excluded.pic);
  return jsonb_build_object('accorde', true, 'plafond', v_plafond, 'appareils', v_actifs);
end; $function$;

CREATE OR REPLACE FUNCTION public.siren_valide(p_siren text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
declare v text := regexp_replace(coalesce(p_siren, ''), '\D', '', 'g'); v_somme int := 0; v_chiffre int; v_i int;
begin
  if length(v) <> 9 then return false; end if;
  if v ~ '^(\d)\1{8}$' then return false; end if;
  for v_i in 0..8 loop
    v_chiffre := substr(v, 9 - v_i, 1)::int;
    if v_i % 2 = 1 then v_chiffre := v_chiffre * 2; if v_chiffre > 9 then v_chiffre := v_chiffre - 9; end if; end if;
    v_somme := v_somme + v_chiffre;
  end loop;
  return v_somme % 10 = 0;
end; $function$;

CREATE OR REPLACE FUNCTION public.version_conditions() RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ select '2026-09-19'::text $function$;

CREATE OR REPLACE FUNCTION public.adresse_propre(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ select case when length(v) between 8 and 200 then v end
  from (select regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g') as v) x $function$;

CREATE OR REPLACE FUNCTION public.gen_company_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text; v_i int; v_octets bytea;
begin
  loop v_code := ''; v_octets := extensions.gen_random_bytes(6);
    for v_i in 1..6 loop v_code := v_code || substr(v_alphabet, (get_byte(v_octets, v_i - 1) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.companies where join_code = v_code); end loop;
  return v_code;
end; $function$;

CREATE OR REPLACE FUNCTION public.gen_store_code() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text; v_i int; v_octets bytea;
begin
  loop v_code := ''; v_octets := extensions.gen_random_bytes(6);
    for v_i in 1..6 loop v_code := v_code || substr(v_alphabet, (get_byte(v_octets, v_i - 1) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.stores where join_code = v_code); end loop;
  return v_code;
end; $function$;
