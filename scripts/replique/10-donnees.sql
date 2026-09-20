-- Un jeu de données qui ressemble à un vrai client : une entreprise abonnée,
-- un magasin, un administrateur d'entreprise, un superviseur, deux compteurs,
-- un inventaire en cours avec ses zones.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@oberlin.fr'),
  ('00000000-0000-0000-0000-0000000000a2', 'superviseur@oberlin.fr'),
  ('00000000-0000-0000-0000-0000000000a3', 'compteur1@oberlin.fr'),
  ('00000000-0000-0000-0000-0000000000a4', 'compteur2@oberlin.fr'),
  ('00000000-0000-0000-0000-0000000000b1', 'quantinvo@devkaylab.fr'),
  ('00000000-0000-0000-0000-0000000000c1', 'inventoriste@exemple.fr');

insert into public.companies (id, name, join_code, plan) values
  ('00000000-0000-0000-0000-00000000c001', 'Maison Oberlin', 'ABCDEF', 'advanced');

insert into public.stores (id, company_id, name, join_code, devices, sqm, address) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-00000000c001',
   'Paris Rivoli', 'STORE1', 20, 600, '12 rue de Rivoli, 75004 Paris');

insert into public.profiles (id, full_name, role, company_id, is_admin, is_company_admin, first_name, last_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Alice Admin', 'supervisor', '00000000-0000-0000-0000-00000000c001', false, true, 'Alice', 'Admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'Simon Superviseur', 'supervisor', '00000000-0000-0000-0000-00000000c001', false, false, 'Simon', 'Superviseur'),
  ('00000000-0000-0000-0000-0000000000a3', 'Carla Compteuse', 'employee', '00000000-0000-0000-0000-00000000c001', false, false, 'Carla', 'Compteuse'),
  ('00000000-0000-0000-0000-0000000000a4', 'Kevin Compteur', 'employee', '00000000-0000-0000-0000-00000000c001', false, false, 'Kevin', 'Compteur'),
  ('00000000-0000-0000-0000-0000000000b1', 'Quantinvo', 'supervisor', null, true, false, 'Quant', 'Invo'),
  -- ⚠️ L'inventoriste indépendant : `employee`, SANS entreprise.
  ('00000000-0000-0000-0000-0000000000c1', 'Ivan Inventoriste', 'employee', null, false, false, 'Ivan', 'Inventoriste');

insert into public.store_supervisors (store_id, user_id) values
  ('00000000-0000-0000-0000-00000000c501', '00000000-0000-0000-0000-0000000000a2');

insert into public.inventory_sessions
  (id, inventory_number, security_code_hash, store_name, status, created_by, company_id, name, store_id, uses_zones)
values ('00000000-0000-0000-0000-00000000e001', 'INV-20260930-AAAA', 'x', 'Paris Rivoli',
        'counting', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000c001',
        'Inventaire de septembre', '00000000-0000-0000-0000-00000000c501', true);

insert into public.session_members (session_id, user_id) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000a3');

insert into public.zones (id, session_id, code, name) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 'Z1', 'Femme rez-de-chaussée'),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e001', 'Z2', 'Réserve allée A');
