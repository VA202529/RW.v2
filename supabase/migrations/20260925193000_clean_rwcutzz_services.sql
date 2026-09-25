update public.services
set is_active = false
where id not in (
  'a2000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000003',
  'a2000000-0000-0000-0000-000000000004',
  '5e17a97a-7089-4fbd-9c67-7b63ad701983'
);

update public.services
set
  name = 'Taper/low/midfade-hairline',
  duration_minutes = 40,
  price_cents = 3000,
  is_active = true
where id = 'a2000000-0000-0000-0000-000000000001';

update public.services
set
  name = 'RWCUT + BEARD',
  duration_minutes = 45,
  price_cents = 3500,
  is_active = true
where id = 'a2000000-0000-0000-0000-000000000002';

update public.services
set
  name = 'Only Hairline',
  duration_minutes = 10,
  price_cents = 1500,
  is_active = true
where id = 'a2000000-0000-0000-0000-000000000003';

update public.services
set
  name = 'Kids Fade (5 t/m 15)',
  duration_minutes = 40,
  price_cents = 2500,
  is_active = true
where id = 'a2000000-0000-0000-0000-000000000004';

update public.services
set
  name = 'Propplekken',
  duration_minutes = 45,
  price_cents = 3500,
  is_active = true
where id = '5e17a97a-7089-4fbd-9c67-7b63ad701983';
