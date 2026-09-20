-- À la carte : le logiciel seul, le temps d'un inventaire.
--
-- ⚠️ CE FICHIER MESURE, IL NE RÉCITE PAS. Les nombres qui suivent sortent de
-- `prix_mission` sur une vraie base, pas d'une table recopiée à la main. C'est
-- ce qui permet de comparer la chaîne SQL à sa copie d'affichage TypeScript
-- (`web/lib/prixOnDemand.ts`) sans que l'une serve de référence à l'autre.
\pset border 2
\pset format aligned

select '── Les deux formules, même dimensionnement ──' as " ";

select
  v.articles                                                    as "articles",
  (public.prix_mission(v.articles,'textile',d.quand,'tous','75001',null,'equipe_quantinvo')->>'inventoristes') as "inventoristes",
  (public.prix_mission(v.articles,'textile',d.quand,'tous','75001',null,'equipe_quantinvo')->>'appareils')     as "appareils",
  (public.prix_mission(v.articles,'textile',d.quand,'tous','75001',null,'equipe_quantinvo')->>'duree_minutes') as "durée (min)",
  ((public.prix_mission(v.articles,'textile',d.quand,'tous','75001',null,'equipe_quantinvo')->>'prix_cents')::integer/100) as "équipe €",
  ((public.prix_mission(v.articles,'textile',d.quand,'tous','75001',null,'logiciel_seul')->>'prix_cents')::integer/100)    as "à la carte €"
from (values (10000),(20000),(30000),(50000)) v(articles),
     (select date_trunc('week', now() + interval '3 weeks') + interval '1 day 20 hours' as quand) d
order by v.articles;

select '── Ce que le logiciel seul ne facture pas ──' as " ";

select
  (p->>'equipe_cents')::integer   as "équipe (cents)",
  (p->>'licence_cents')::integer  as "licence (cents)",
  (p->>'frais_cents')::integer    as "frais (cents)",
  (p->>'cout_cents')::integer     as "coût (cents)",
  (p->>'prix_cents')::integer     as "prix (cents)",
  (p->>'remuneration_inventoriste_cents')::integer as "payé à quelqu'un"
from (select public.prix_mission(20000,'textile',
        date_trunc('week', now() + interval '3 weeks') + interval '1 day 20 hours',
        'tous','75001',null,'logiciel_seul') as p) x;

select '── Trois refus tombent avec l''équipe ──' as " ";

select 'Bordeaux (33), avec équipe' as "cas",
       coalesce(public.prix_mission(20000,'textile', now() + interval '10 days','tous','33000',null,'equipe_quantinvo')->>'code','ACCEPTÉ') as "réponse"
union all
select 'Bordeaux (33), logiciel seul',
       coalesce(public.prix_mission(20000,'textile', now() + interval '10 days','tous','33000',null,'logiciel_seul')->>'code','ACCEPTÉ')
union all
select 'Ce soir (dans 3 h), avec équipe',
       coalesce(public.devis_mission(jsonb_build_object(
         'articles_max',20000,'secteur','textile','code_postal','75001',
         'debut', now() + interval '3 hours','formule','equipe_quantinvo'))->>'code','ACCEPTÉ')
union all
select 'Ce soir (dans 3 h), logiciel seul',
       coalesce(public.devis_mission(jsonb_build_object(
         'articles_max',20000,'secteur','textile','code_postal','75001',
         'debut', now() + interval '3 hours','formule','logiciel_seul'))->>'code','ACCEPTÉ')
union all
select 'Hier, logiciel seul',
       coalesce(public.devis_mission(jsonb_build_object(
         'articles_max',20000,'secteur','textile','code_postal','75001',
         'debut', now() - interval '1 day','formule','logiciel_seul'))->>'code','ACCEPTÉ')
union all
select 'Formule inventée',
       coalesce(public.devis_mission(jsonb_build_object(
         'articles_max',20000,'secteur','textile','code_postal','75001',
         'debut', now() + interval '10 days','formule','gratuit'))->>'code','ACCEPTÉ');

select '── Ce que le devis laisse voir au client ──' as " ";

select string_agg(k, ', ' order by k) as "clés rendues"
from jsonb_object_keys(public.devis_mission(jsonb_build_object(
  'articles_max',20000,'secteur','textile','code_postal','75001',
  'debut', now() + interval '10 days','formule','logiciel_seul'))) k;

select '── La machine d''état connaît les deux formules ──' as " ";

select t.de || ' → ' || t.vers as "transition",
       case when public.transition_mission_permise(t.de,t.vers,'equipe_quantinvo') then 'oui' else 'NON' end as "avec équipe",
       case when public.transition_mission_permise(t.de,t.vers,'logiciel_seul')    then 'oui' else 'NON' end as "logiciel seul"
from (values
  ('confirmee','en_constitution'),
  ('confirmee','prete'),
  ('terminee','paiement_prestataires'),
  ('terminee','payee'),
  ('prete','en_cours'),
  ('en_cours','controle_qualite')
) t(de,vers);
