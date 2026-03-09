-- NeoTicket - Payout receiver metadata + rejected status

alter table payouts
  add column if not exists receiver_name text,
  add column if not exists receiver_phone text;

-- Add rejected status for manual admin workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payout_status'
      AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE payout_status ADD VALUE 'rejected';
  END IF;
END $$;

alter table payouts
  drop constraint if exists payouts_paid_at_chk;

alter table payouts
  add constraint payouts_paid_at_chk
  check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
    or (status::text = 'rejected' and paid_at is null)
  );

-- receiver phone is optional but must be E.164 when provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payouts_receiver_phone_e164_chk'
      AND conrelid = 'payouts'::regclass
  ) THEN
    ALTER TABLE payouts
      ADD CONSTRAINT payouts_receiver_phone_e164_chk
      CHECK (receiver_phone IS NULL OR receiver_phone ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;
