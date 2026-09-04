-- ============================================================================
-- LE MAGASIN CRÉÉ DEMANDE QUI LE SUPERVISE (4 septembre 2026)
-- ----------------------------------------------------------------------------
-- Julien, au retour de son premier paiement : *« une fois le paiement accepté,
-- ouvrir un pop-up pour ajouter des superviseurs sur le magasin, ça évite de
-- chercher la page équipe du magasin. »*
--
-- Un magasin sans superviseur ne sert à rien : personne ne peut y lancer
-- d'inventaire. Le geste suivant est donc toujours le même, et il était à
-- chercher deux écrans plus loin.
--
-- ⚠️ CETTE FONCTION NE FAIT QUE RÉPONDRE « QUEL MAGASIN ». L'affectation, elle,
-- passe par `ca_set_supervisor_stores`, qui existe déjà et qui porte ses
-- gardes : on n'écrit pas un second chemin d'affectation pour une fenêtre.
-- ============================================================================

create or replace function public.magasin_cree_par(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'store_id', r.store_id,
           'magasin', r.store_name,
           'statut', r.status)
    into v
    from public.store_requests r
   where r.id = p_id
     -- ⚠️ La garde porte sur l'entreprise DE LA DEMANDE, jamais sur un
     -- paramètre de l'appelant.
     and (public.is_admin() or public.is_company_admin(r.company_id));

  -- ⚠️ ELLE REND LE STATUT MÊME QUAND LE MAGASIN N'EXISTE PAS ENCORE, et c'est
  -- volontaire : Stripe renvoie le client sur notre page AVANT que le webhook
  -- n'ait forcément tourné. L'écran doit pouvoir distinguer « ça arrive » de
  -- « il n'y a rien à voir », sinon il n'attend pas et la fenêtre ne s'ouvre
  -- jamais.
  return v;
end;
$$;

revoke all on function public.magasin_cree_par(uuid) from public, anon;
grant execute on function public.magasin_cree_par(uuid) to authenticated, service_role;
