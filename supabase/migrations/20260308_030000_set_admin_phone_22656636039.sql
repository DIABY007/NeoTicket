-- NeoTicket - Promote +22656636039 as admin (idempotent)
-- - Create user if missing
-- - Ensure admin role is present if user already exists
-- - Ensure account is active

insert into users (phone, roles, status)
values ('+22656636039', array['admin']::text[], 'active')
on conflict (phone)
do update
set
  roles = case
    when users.roles @> array['admin']::text[] then users.roles
    else array_prepend('admin', users.roles)
  end,
  status = 'active';
