-- Part of the "UPSC-centric institute" repositioning (companion to PR #117, which reworded the
-- SEO/hero copy). The exam_categories.order_num column drives homepage/nav category ordering;
-- before this it put the two KAS-branded categories first (order_num 1) and UPSC CSE second
-- (order_num 2), which contradicted the new copy's "UPSC CSE first" framing.
--
-- Before:
--   kas_gp (KAS KAS- FREE TESTS+PYQ)              order_num 1
--   kpsc_kas (KPSC KAS)                            order_num 1
--   upsc_cse (UPSC CSE)                            order_num 2
--   karnataka_psi (inactive)                       order_num 2
--   kpsc_fda_sda (inactive)                        order_num 3
--
-- After: UPSC CSE leads, then the main KAS exam, then the free-test bucket, then the two
-- currently-inactive/content-empty categories last (order doesn't matter much for these since
-- they're not shown, but keeping them out of the way).

UPDATE exam_categories SET order_num = 1 WHERE id = 'upsc_cse';
UPDATE exam_categories SET order_num = 2 WHERE id = 'kpsc_kas';
UPDATE exam_categories SET order_num = 3 WHERE id = 'kas_gp';
UPDATE exam_categories SET order_num = 4 WHERE id = 'karnataka_psi';
UPDATE exam_categories SET order_num = 5 WHERE id = 'kpsc_fda_sda';

-- Verified after running: SELECT id, order_num FROM exam_categories ORDER BY order_num; returns
-- upsc_cse(1), kpsc_kas(2), kas_gp(3), karnataka_psi(4), kpsc_fda_sda(5).
