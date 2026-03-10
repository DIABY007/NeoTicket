-- NeoTicket - WhatsApp reminders log for J-3 / J-1 / H-3

create table if not exists whatsapp_reminders (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  reminder_type text not null,
  provider text not null default 'wasender',
  sent_at timestamptz not null default now(),
  constraint whatsapp_reminders_type_chk check (reminder_type in ('D3', 'D1', 'H3'))
);

create unique index if not exists whatsapp_reminders_unique_ticket_type
  on whatsapp_reminders (ticket_id, reminder_type);

create index if not exists idx_whatsapp_reminders_event_sent
  on whatsapp_reminders (event_id, sent_at desc);
