-- NeoTicket - Orange Money Burkina Faso schema update (phase SQL only)
-- Scope requested: transactions, tickets, payouts
-- Idempotent migration for existing schema

-- -----------------------------------------------------------------------------
-- 1) TRANSACTIONS
-- -----------------------------------------------------------------------------
-- Add Orange Money lifecycle fields
alter table transactions
  add column if not exists currency text not null default 'XOF',
  add column if not exists om_order_id text,
  add column if not exists om_payment_id text,
  add column if not exists om_otp_reference text,
  add column if not exists otp_verified_at timestamptz,
  add column if not exists payment_initiated_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists webhook_received_at timestamptz,
  add column if not exists webhook_verified boolean not null default false,
  add column if not exists webhook_signature text,
  add column if not exists provider_payload jsonb,
  add column if not exists idempotency_key text,
  add column if not exists buyer_phone_e164 text generated always as (buyer_phone) stored;

-- Keep provider reference unique when present (safe for retries)
create unique index if not exists uq_transactions_provider_reference_not_null
  on transactions(provider_reference)
  where provider_reference is not null;

create unique index if not exists uq_transactions_om_order_id_not_null
  on transactions(om_order_id)
  where om_order_id is not null;

create unique index if not exists uq_transactions_om_payment_id_not_null
  on transactions(om_payment_id)
  where om_payment_id is not null;

create unique index if not exists uq_transactions_idempotency_key_not_null
  on transactions(idempotency_key)
  where idempotency_key is not null;

-- Faster lookups for webhook/status checks
create index if not exists idx_transactions_event_status_created
  on transactions(event_id, status, created_at desc);

create index if not exists idx_transactions_buyer_phone_status
  on transactions(buyer_phone, status);

-- Enforce strict currency for MVP (XOF only)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_currency_xof_chk'
      and conrelid = 'transactions'::regclass
  ) then
    alter table transactions
      add constraint transactions_currency_xof_chk
      check (currency = 'XOF');
  end if;
end $$;

-- Enforce commission formula: commission = round(total * 0.10)
-- and organizer = total - commission
-- (rounding rule explicitly required for FCFA)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_commission_formula_chk'
      and conrelid = 'transactions'::regclass
  ) then
    alter table transactions
      add constraint transactions_commission_formula_chk
      check (
        commission_amount = round(total_amount * 0.10)
        and organizer_amount = total_amount - commission_amount
      );
  end if;
end $$;

-- Ensure lifecycle timestamps are coherent with status
-- pending: paid_at/failed_at should be null
-- success: paid_at required
-- failed: failed_at required
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_status_timestamps_chk'
      and conrelid = 'transactions'::regclass
  ) then
    alter table transactions
      add constraint transactions_status_timestamps_chk
      check (
        (status = 'pending' and paid_at is null and failed_at is null)
        or (status = 'success' and paid_at is not null)
        or (status = 'failed' and failed_at is not null)
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) TICKETS
-- -----------------------------------------------------------------------------
-- Add delivery/audit fields linked to payment and QR lifecycle
alter table tickets
  add column if not exists payment_confirmed_at timestamptz,
  add column if not exists scanned_at timestamptz,
  add column if not exists qr_generated_at timestamptz,
  add column if not exists qr_delivered_via text,
  add column if not exists qr_delivered_at timestamptz,
  add column if not exists qr_delivery_error text,
  add column if not exists updated_by_webhook boolean not null default false,
  add column if not exists buyer_phone_e164 text generated always as (buyer_phone) stored;

create index if not exists idx_tickets_event_status
  on tickets(event_id, status);

create index if not exists idx_tickets_buyer_phone_status
  on tickets(buyer_phone, status);

create unique index if not exists uq_tickets_qr_code_hash_not_null
  on tickets(qr_code_hash)
  where qr_code_hash is not null;

-- Coherent ticket status dates
-- paid/scanned => payment_confirmed_at required
-- scanned => scanned_at required
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_status_timestamps_chk'
      and conrelid = 'tickets'::regclass
  ) then
    alter table tickets
      add constraint tickets_status_timestamps_chk
      check (
        (status in ('pending', 'cancelled'))
        or (status in ('paid', 'scanned') and payment_confirmed_at is not null)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tickets_scanned_at_chk'
      and conrelid = 'tickets'::regclass
  ) then
    alter table tickets
      add constraint tickets_scanned_at_chk
      check (
        (status <> 'scanned') or (scanned_at is not null)
      );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) PAYOUTS
-- -----------------------------------------------------------------------------
-- Add fields for manual settlement traceability
alter table payouts
  add column if not exists requested_by uuid references users(id) on delete set null,
  add column if not exists approved_by uuid references users(id) on delete set null,
  add column if not exists payment_reference text,
  add column if not exists payment_channel text,
  add column if not exists notes text,
  add column if not exists amount_currency text not null default 'XOF',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Align payouts with XOF-only MVP
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payouts_currency_xof_chk'
      and conrelid = 'payouts'::regclass
  ) then
    alter table payouts
      add constraint payouts_currency_xof_chk
      check (amount_currency = 'XOF');
  end if;
end $$;

-- Keep payment reference unique when present
create unique index if not exists uq_payouts_payment_reference_not_null
  on payouts(payment_reference)
  where payment_reference is not null;

create index if not exists idx_payouts_event_status_requested
  on payouts(event_id, status, requested_at desc);

-- Add updated_at trigger for payouts if not already present
-- (set_updated_at function exists from initial migration)
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'payouts_set_updated_at'
      and tgrelid = 'payouts'::regclass
  ) then
    create trigger payouts_set_updated_at
    before update on payouts
    for each row execute function set_updated_at();
  end if;
end $$;
