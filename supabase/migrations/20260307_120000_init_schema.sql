-- NeoTicket MVP - Phase 1.2 schema initialization
-- Target: Supabase Postgres

create extension if not exists pgcrypto;

-- Enums
create type user_status as enum ('active', 'invited', 'blocked');
create type event_status as enum ('draft', 'published', 'ended', 'cancelled');
create type ticket_status as enum ('pending', 'paid', 'scanned', 'cancelled');
create type transaction_status as enum ('pending', 'success', 'failed');
create type payout_status as enum ('pending', 'paid');

-- Trigger function to keep updated_at consistent
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  roles text[] not null default array['buyer']::text[],
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_phone_e164_chk check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  constraint users_roles_not_empty_chk check (array_length(roles, 1) >= 1)
);

create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

-- Events
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references users(id) on delete restrict,
  title text not null,
  description text,
  date timestamptz not null,
  end_date timestamptz,
  price numeric(12,0) not null,
  image_url text,
  status event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_price_positive_chk check (price >= 0),
  constraint events_end_after_start_chk check (end_date is null or end_date >= date)
);

create trigger events_set_updated_at
before update on events
for each row execute function set_updated_at();

-- Tickets
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  buyer_id uuid references users(id) on delete set null,
  buyer_phone text not null,
  qr_code_hash text unique,
  status ticket_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_phone_e164_chk check (buyer_phone ~ '^\+[1-9][0-9]{6,14}$')
);

create trigger tickets_set_updated_at
before update on tickets
for each row execute function set_updated_at();

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references tickets(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  buyer_phone text not null,
  total_amount numeric(12,0) not null,
  commission_amount numeric(12,0) not null,
  organizer_amount numeric(12,0) not null,
  provider_reference text,
  status transaction_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_phone_e164_chk check (buyer_phone ~ '^\+[1-9][0-9]{6,14}$'),
  constraint transactions_amounts_non_negative_chk check (
    total_amount >= 0
    and commission_amount >= 0
    and organizer_amount >= 0
  ),
  constraint transactions_amounts_balance_chk check (
    total_amount = commission_amount + organizer_amount
  )
);

create trigger transactions_set_updated_at
before update on transactions
for each row execute function set_updated_at();

-- EventScanners
create table if not exists event_scanners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_scanners_unique_event_user unique (event_id, user_id)
);

-- Payouts
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  amount numeric(12,0) not null,
  status payout_status not null default 'pending',
  requested_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payouts_amount_positive_chk check (amount >= 0),
  constraint payouts_paid_at_chk check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
  )
);

-- Indexes for core access patterns
create index if not exists idx_users_phone on users (phone);
create index if not exists idx_events_organizer_id on events (organizer_id);
create index if not exists idx_events_status_date on events (status, date);
create index if not exists idx_tickets_event_id on tickets (event_id);
create index if not exists idx_tickets_buyer_phone on tickets (buyer_phone);
create index if not exists idx_tickets_qr_code_hash on tickets (qr_code_hash);
create index if not exists idx_transactions_event_id on transactions (event_id);
create index if not exists idx_transactions_status on transactions (status);
create index if not exists idx_transactions_provider_reference on transactions (provider_reference);
create index if not exists idx_event_scanners_event_id on event_scanners (event_id);
create index if not exists idx_event_scanners_user_id on event_scanners (user_id);
create index if not exists idx_payouts_event_id on payouts (event_id);
create index if not exists idx_payouts_status on payouts (status);

-- Helper view for payout eligibility window
create or replace view v_events_with_effective_end as
select
  e.*,
  coalesce(e.end_date, e.date + interval '24 hours') as effective_end_at
from events e;
