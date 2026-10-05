-- ============================================================
--  Data-only seed (no app-code change) -- the subject_groups table and its RLS were created in
--  sql/create_subject_groups_table.sql; this just populates the admin's first real group.
--
--  KPSC KAS had accumulated ~90 registered subjects (see exam_subjects), of which 28 are really
--  Karnataka-history sub-topics each registered as their own subject (individual dynasties/
--  kingdoms/periods: Adilshahis, Wodeyars of Mysuru, Hoysalas, Vijayanagara, etc.) -- exactly why
--  the admin's Weakness/Strength dashboard had grown so long. This folds all 28 into one
--  "Karnataka History" group for that category, via Dev Console's new Subject groups tool
--  (js/11d_study_planner_admin_csv.js / js/01_exam_category_master.js, PR #26).
--
--  Left OUT deliberately (mixed-subject names, a judgment call -- can be added later the same way,
--  either through this table directly or via the Dev Console UI):
--    "History, Art & Culture" (also Art), "Karnataka History & Culture – CA" (also Current
--    Affairs), "Karnataka History & Economy" (also Economy).
--  Also left out as genuinely separate (non-History) subjects: "Art & Culture", "Karnataka
--  Culture", "Karnataka Literature", "Karnataka Personalities".
--
--  Verified after running: exactly 28 members, matching the list below. Safe to re-run -- the
--  upsert just overwrites this one (category_id, group_name) row with the same membership.
-- ============================================================

INSERT INTO public.subject_groups (category_id, group_name, member_subjects, updated_at)
VALUES ('kpsc_kas', 'Karnataka History', '[
  "Adilshahis", "Alupas", "Badami Chalukyas", "Bahmani Kingdom", "British Rule in Karnataka",
  "Early Karnataka History", "Freedom Movement", "History", "History & Culture", "Hoysalas",
  "Hyder Ali and Tipu Sultan", "Kadambas", "Kalyana Chalukyas", "Karnataka History",
  "Karnataka Unification", "Keladi Kingdom", "Mauryan Karnataka", "Modern History",
  "Modern Mysuru", "Prehistory", "Rashtrakutas", "Regional Kingdoms",
  "Renaissance and Print Culture", "Renaissance and Unification", "Satavahanas", "Vijayanagara",
  "Western Gangas", "Wodeyars of Mysuru"
]'::jsonb, now())
ON CONFLICT (category_id, group_name) DO UPDATE SET member_subjects = EXCLUDED.member_subjects, updated_at = now();
