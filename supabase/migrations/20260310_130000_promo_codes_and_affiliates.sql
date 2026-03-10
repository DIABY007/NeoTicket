-- NeoTicket - Promo codes & affiliate tracking

-- ═══════════════════════════════════════════════
-- 1. promo_codes table
-- ═══════════════════════════════════════════════

create table promo_codes (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  code        text not null,
  discount_percent int not null check (discount_percent between 1 and 100),
  max_uses    int not null check (max_uses > 0),
  current_uses int not null default 0 check (current_uses >= 0),
  expires_at  timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Unique uppercase code per event
create unique index promo_codes_code_event_uniq on promo_codes (upper(code), event_id);

alter table promo_codes enable row level security;

-- Organizer can manage promo codes for own events
create policy "organizer_manage_promo_codes"
  on promo_codes
  for all
  using (
    event_id in (
      select id from events where organizer_id = (
        select id from users where id = auth.uid()
      )
    )
  );

-- Admin full access
create policy "admin_full_promo_codes"
  on promo_codes
  for all
  using (
    exists (
      select 1 from users where id = auth.uid() and roles @> array['admin']::text[]
    )
  );

-- Service role bypass (for server-side API routes)
create policy "service_role_promo_codes"
  on promo_codes
  for all
  using (true)
  with check (true);

-- ═══════════════════════════════════════════════
-- 2. affiliates table
-- ═══════════════════════════════════════════════

create table affiliates (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  ambassador_name text not null,
  ref_code        text not null,
  sales_count     int not null default 0 check (sales_count >= 0),
  created_at      timestamptz not null default now()
);

-- Unique ref_code per event
create unique index affiliates_ref_code_event_uniq on affiliates (lower(ref_code), event_id);

alter table affiliates enable row level security;

-- Organizer can manage affiliates for own events
create policy "organizer_manage_affiliates"
  on affiliates
  for all
  using (
    event_id in (
      select id from events where organizer_id = (
        select id from users where id = auth.uid()
      )
    )
  );

-- Admin full access
create policy "admin_full_affiliates"
  on affiliates
  for all
  using (
    exists (
      select 1 from users where id = auth.uid() and roles @> array['admin']::text[]
    )
  );

-- Service role bypass
create policy "service_role_affiliates"
  on affiliates
  for all
  using (true)
  with check (true);

-- ═══════════════════════════════════════════════
-- 3. Add promo/affiliate tracking to tickets
-- ═══════════════════════════════════════════════

alter table tickets
  add column if not exists promo_code_id uuid references promo_codes(id) on delete set null,
  add column if not exists affiliate_id  uuid references affiliates(id) on delete set null;
