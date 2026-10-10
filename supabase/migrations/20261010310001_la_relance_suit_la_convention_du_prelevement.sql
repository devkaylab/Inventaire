-- La relance suit la convention de sa voisine (10 octobre 2026)
--
-- ⚠️ **TROIS CONVENTIONS POUR DEUX TÂCHES, C'EST UNE DE TROP.** Le chantier
-- On-Demand a deux tâches planifiées qui réveillent une fonction edge :
--
--   · `declencher_le_prelevement` lit `prelevement_url` + `prelevement_cle` ;
--   · `declencher_relance_reservation`, écrite ce matin, lisait `alerte_cle`
--     + `base_fonctions`.
--
-- Deux noms, deux formes — une URL complète d'un côté, une base à compléter de
-- l'autre — et une clé EMPRUNTÉE au tour de garde de Quantinvo OS. Qui pose
-- ces secrets doit déjà en tenir quatre ; lui en faire tenir deux formes
-- différentes, c'est préparer l'oubli.
--
-- La relance prend donc `relance_url` + `relance_cle`, exactement comme sa
-- voisine. Et elle cesse d'emprunter `alerte_cle` : une clé partagée entre
-- deux fonctions fait que qui peut réveiller l'une peut réveiller l'autre.
--
-- ⚠️ Ce qui ne change PAS : l'adresse vient du coffre, jamais du corps de la
-- fonction. `declencher_alerte` porte celle de la production en dur, et ce
-- chantier vit sur deux projets — une adresse en dur ferait relancer les
-- clients de l'un depuis l'autre.
create or replace function public.declencher_relance_reservation()
returns void
language plpgsql
security definer
set search_path to 'public', 'vault', 'net'
as $function$
declare
  v_url text;
  v_cle text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'relance_url' limit 1;
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'relance_cle' limit 1;

  -- Tant que l'un des deux manque, la tâche ne fait rien : elle est
  -- inoffensive avant sa configuration.
  if coalesce(btrim(v_url), '') = '' or coalesce(btrim(v_cle), '') = '' then
    raise notice 'relance : « relance_url » ou « relance_cle » absent du coffre, rien à faire';
    return;
  end if;

  -- Rien à envoyer ? On ne réveille personne.
  if not exists (select 1 from public.missions_a_relancer()) then
    return;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-relance-cle', v_cle),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

revoke all on function public.declencher_relance_reservation() from public, anon, authenticated;
