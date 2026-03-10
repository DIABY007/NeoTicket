-- NeoTicket - Allow free events (0 FCFA)

alter table events
  drop constraint if exists events_official_price_positive_chk,
  drop constraint if exists events_organizer_price_positive_chk,
  drop constraint if exists events_prices_consistent_chk;

alter table events
  add constraint events_official_price_non_negative_chk check (official_price >= 0),
  add constraint events_organizer_price_non_negative_chk check (organizer_price >= 0),
  add constraint events_prices_consistent_chk check (official_price >= organizer_price);
