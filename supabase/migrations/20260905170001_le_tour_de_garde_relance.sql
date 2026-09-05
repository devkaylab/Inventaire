-- Le tour de garde porte aussi les relances d'inscription (5 septembre 2026)
--
-- ⚠️ UNE RELANCE N'EST PAS UNE ANOMALIE, et c'est pour ça qu'elle ne passe pas
-- par `anomalies_a_signaler` : elle a sa propre mémoire (`inscriptions.relances`
-- et `derniere_relance_le`), son propre calendrier (J+1, J+8, J+21) et son
-- propre destinataire — le prospect, pas nous. La mêler aux anomalies l'aurait
-- fait hériter du rappel à 24 h, donc d'un quatrième envoi.
--
-- Ce qui change ici tient en une condition : le tour de garde se réveille
-- aussi quand une relance attend. Le silence reste le cas normal.
create or replace function public.declencher_alerte()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $function$
declare v_cle text;
begin
  select decrypted_secret into v_cle
    from vault.decrypted_secrets where name = 'alerte_cle' limit 1;

  if v_cle is null or btrim(v_cle) = '' then
    raise notice 'alerte : secret « alerte_cle » absent du coffre, rien à faire';
    return;
  end if;

  -- Rien à signaler ET rien à relancer : on ne réveille même pas la fonction
  -- edge. C'est ce silence qui rend l'alerte crédible.
  if jsonb_array_length(public.anomalies_a_signaler()) = 0
     and not exists (select 1 from public.inscriptions_a_relancer()) then
    return;
  end if;

  perform net.http_post(
    url     := 'https://heabesqvlinzarqenymj.supabase.co/functions/v1/alerte-anomalies',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-alerte-cle', v_cle),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$function$;

revoke all on function public.declencher_alerte() from public, anon, authenticated;
grant execute on function public.declencher_alerte() to service_role;
