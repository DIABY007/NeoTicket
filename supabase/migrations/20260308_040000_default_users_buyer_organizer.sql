-- NeoTicket - Make all accounts organizer by default (without removing buyer)
-- Goals:
-- 1) New users get roles ['buyer','organizer'] by default
-- 2) Existing users receive organizer role if missing

alter table users
  alter column roles set default array['buyer', 'organizer']::text[];

update users
set roles = case
  when roles @> array['organizer']::text[] then roles
  else array_append(roles, 'organizer')
end;
