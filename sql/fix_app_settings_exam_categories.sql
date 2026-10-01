-- ============================================================
--  Evolve+ — app_settings + exam_categories tables
--  Safe to run multiple times (IF NOT EXISTS / DROP+CREATE POLICY).
--  Matches exactly what index.html's cloud-sync functions expect:
--   - fetchCloudAppSetting / saveCloudAppSetting  -> app_settings(key, value)
--   - fetchCloudExamCategories / ensureExamCategoriesSeeded / saveExamCategory
--     / deleteExamCategoryMaster -> exam_categories(id, name, desc,
--     default_scheme, order_num, active)
-- ============================================================

-- Generic key/value settings store (pricing_master, auth_settings,
-- feature_access, planners, announcements, admin_auth, home_config, etc.)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings read"   ON public.app_settings;
DROP POLICY IF EXISTS "app_settings insert" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings update" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings delete" ON public.app_settings;
CREATE POLICY "app_settings read"   ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings insert" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "app_settings update" ON public.app_settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "app_settings delete" ON public.app_settings FOR DELETE USING (true);

-- Exam category master (KPSC KAS, Karnataka PSI, etc. — now admin-editable
-- instead of hardcoded)
CREATE TABLE IF NOT EXISTS public.exam_categories (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  "desc"         text,
  default_scheme jsonb,
  order_num      integer DEFAULT 0,
  active         boolean DEFAULT true
);

-- Belt-and-suspenders for anyone re-running this on a table that already existed before this
-- script's column list was finalized: CREATE TABLE IF NOT EXISTS above is a no-op on an existing
-- table, so it silently does NOT add columns that were missing. This ADD COLUMN IF NOT EXISTS
-- patches that regardless of which case you're in.
ALTER TABLE public.exam_categories
  ADD COLUMN IF NOT EXISTS "desc" text,
  ADD COLUMN IF NOT EXISTS default_scheme jsonb,
  ADD COLUMN IF NOT EXISTS order_num integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exam_categories read"   ON public.exam_categories;
DROP POLICY IF EXISTS "exam_categories insert" ON public.exam_categories;
DROP POLICY IF EXISTS "exam_categories update" ON public.exam_categories;
DROP POLICY IF EXISTS "exam_categories delete" ON public.exam_categories;
CREATE POLICY "exam_categories read"   ON public.exam_categories FOR SELECT USING (true);
CREATE POLICY "exam_categories insert" ON public.exam_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "exam_categories update" ON public.exam_categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "exam_categories delete" ON public.exam_categories FOR DELETE USING (true);
