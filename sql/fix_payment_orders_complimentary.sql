-- ============================================================
--  Evolve+ — complimentary tag + internal note on payment approvals
--  Run this once in the Supabase SQL editor before approving any
--  payment with the new "complimentary" option in the admin panel.
--
--  complimentary: true means this approval was a waived/free grant
--  (someone asked, you said yes) rather than a real payment that
--  cleared. It still unlocks the item for the student, but is
--  excluded from every revenue total (Overview + Revenue tab) so
--  "Collected" reflects only real money received.
--
--  admin_note: optional free-text note to yourself on why an order
--  was approved a certain way. Never shown to the student.
--
--  Safe to run more than once.
-- ============================================================

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS complimentary boolean DEFAULT false;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS admin_note text;

UPDATE public.payment_orders SET complimentary = false WHERE complimentary IS NULL;

NOTIFY pgrst, 'reload schema';
