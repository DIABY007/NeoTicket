-- NeoTicket - Stacked promotions (organizer + platform)

alter table events
  add column if not exists official_price numeric(12,0),
  add column if not exists organizer_price numeric(12,0);

-- Backfill existing events from legacy price column.
update events
set
  official_price = coalesce(official_price, price),
  organizer_price = coalesce(organizer_price, price)
where official_price is null or organizer_price is null;

alter table events
  alter column official_price set not null,
  alter column organizer_price set not null;

alter table events
  drop constraint if exists events_official_price_positive_chk,
  drop constraint if exists events_organizer_price_positive_chk,
  drop constraint if exists events_prices_consistent_chk;

alter table events
  add constraint events_official_price_positive_chk check (official_price > 0),
  add constraint events_organizer_price_positive_chk check (organizer_price > 0),
  add constraint events_prices_consistent_chk check (official_price >= organizer_price);

create table if not exists platform_settings (
  id smallint primary key default 1,
  platform_discount_percent numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton_chk check (id = 1),
  constraint platform_discount_percent_range_chk check (
    platform_discount_percent >= 0 and platform_discount_percent <= 100
  )
);

insert into platform_settings (id, platform_discount_percent)
values (1, 0)
on conflict (id) do nothing;

-- Keep updated_at aligned with other tables.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'platform_settings_set_updated_at'
      and tgrelid = 'platform_settings'::regclass
  ) then
    create trigger platform_settings_set_updated_at
    before update on platform_settings
    for each row execute function set_updated_at();
  end if;
end $$;
