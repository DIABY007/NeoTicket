-- NeoTicket - Add city to events for feed filtering

alter table events
  add column if not exists city text;

alter table events
  drop constraint if exists events_city_len_chk;

alter table events
  add constraint events_city_len_chk
  check (
    city is null
    or char_length(btrim(city)) between 2 and 120
  );