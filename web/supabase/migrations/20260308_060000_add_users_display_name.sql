-- NeoTicket - Add optional display name for buyer-facing greetings

alter table users
  add column if not exists display_name text;

alter table users
  drop constraint if exists users_display_name_len_chk;

alter table users
  add constraint users_display_name_len_chk
  check (
    display_name is null
    or char_length(btrim(display_name)) between 2 and 80
  );