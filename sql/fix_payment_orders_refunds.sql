-- ============================================================
--  Evolve+ — refund support (full or partial) on payment orders
--  Run this once before using the new "Refund" button in Admin →
--  Payments (an order must already be Approved to show it).
--
--  refunded_amount: running total refunded so far on this order (0
--  until a refund happens; can grow across more than one partial
--  refund). A refund that brings this up to the full original
--  amount flips status to 'refunded' — every revenue total already
--  filters on status = 'approved', so a fully refunded order drops
--  out of "Collected" automatically, with no other code change
--  needed. A partial refund leaves status 'approved' (net revenue
--  for that order = amount - refunded_amount) and never touches the
--  student's access.
--
--  refunded_at / refund_reason: when and why, for your own records.
--  Never shown to the student beyond the refunded amount itself.
--
--  The DO block below defensively drops any CHECK constraint on the
--  status column before adding the new column — in case one exists
--  that only allows ('pending','approved','rejected') and would
--  otherwise reject the new 'refunded' value. No-op if none exists.
--
--  Safe to run more than once.
-- ============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'payment_orders' AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payment_orders DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE public.payment_orders ADD COLUMN IF NOT EXISTS refund_reason text;

UPDATE public.payment_orders SET refunded_amount = 0 WHERE refunded_amount IS NULL;

NOTIFY pgrst, 'reload schema';
