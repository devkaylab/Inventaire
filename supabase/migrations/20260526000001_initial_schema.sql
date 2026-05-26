-- Initial schema for the Inventaire app
-- Applied to project: inventaire-smartcount (heabesqvlinzarqenymj)

-- 1. profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('supervisor', 'employee')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'employee'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Helper function
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 3. profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR get_my_role() = 'supervisor');
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- 4. articles
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  ean text,
  brand text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  unit_purchase_price numeric(10, 2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX articles_ean_idx ON public.articles(ean);
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_select_auth" ON public.articles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "articles_write_supervisor" ON public.articles FOR ALL USING (get_my_role() = 'supervisor');

-- 5. inventory_sessions
CREATE TABLE public.inventory_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_number text NOT NULL UNIQUE,
  security_code_hash text NOT NULL,
  store_name text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'counting', 'closed')),
  current_pass int NOT NULL DEFAULT 1 CHECK (current_pass BETWEEN 1 AND 3),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

-- 6. session_members
CREATE TABLE public.session_members (
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE public.session_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_members_supervisor" ON public.session_members FOR ALL USING (get_my_role() = 'supervisor');
CREATE POLICY "session_members_own" ON public.session_members FOR SELECT USING (user_id = auth.uid());

-- 7. inventory_sessions RLS (now session_members exists)
CREATE POLICY "sessions_supervisor_all" ON public.inventory_sessions FOR ALL USING (get_my_role() = 'supervisor');
CREATE POLICY "sessions_employee_select" ON public.inventory_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.session_members sm WHERE sm.session_id = id AND sm.user_id = auth.uid())
);

-- 8. theoretical_stock
CREATE TABLE public.theoretical_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  sku text NOT NULL,
  theoretical_qty numeric(10, 3) NOT NULL DEFAULT 0,
  UNIQUE (session_id, sku)
);
ALTER TABLE public.theoretical_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theoretical_stock_supervisor" ON public.theoretical_stock FOR ALL USING (get_my_role() = 'supervisor');

-- 9. counts
CREATE TABLE public.counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  sku text NOT NULL,
  pass_number int NOT NULL CHECK (pass_number BETWEEN 1 AND 3),
  qty numeric(10, 3) NOT NULL DEFAULT 1,
  counted_by uuid NOT NULL REFERENCES public.profiles(id),
  zone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX counts_session_pass_idx ON public.counts(session_id, pass_number);
CREATE INDEX counts_session_sku_pass_idx ON public.counts(session_id, sku, pass_number);
ALTER TABLE public.counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counts_insert_member" ON public.counts FOR INSERT WITH CHECK (
  counted_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.session_members sm WHERE sm.session_id = counts.session_id AND sm.user_id = auth.uid())
  AND pass_number = (SELECT current_pass FROM public.inventory_sessions WHERE id = counts.session_id)
);
CREATE POLICY "counts_select_own" ON public.counts FOR SELECT USING (counted_by = auth.uid());
CREATE POLICY "counts_select_supervisor" ON public.counts FOR SELECT USING (get_my_role() = 'supervisor');

-- 10. article_audit
CREATE TABLE public.article_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.inventory_sessions(id) ON DELETE CASCADE,
  sku text NOT NULL,
  qty_pass1 numeric(10, 3),
  qty_pass2 numeric(10, 3),
  qty_pass3 numeric(10, 3),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'failed', 'resolved')),
  final_qty numeric(10, 3),
  resolved_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, sku)
);
ALTER TABLE public.article_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_supervisor" ON public.article_audit FOR ALL USING (get_my_role() = 'supervisor');

-- 11. RPCs (see migration content in apply_migration calls above)
