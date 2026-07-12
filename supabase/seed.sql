insert into public.services
  (name, description, price_cents, duration_minutes, buffer_minutes, deposit_type, deposit_value, is_active)
values
  ('Classic Cut', 'Strakke knipbeurt inclusief styling.', 3500, 30, 5, 'fixed', 1000, true),
  ('Skin Fade', 'Fade met extra detailwerk en afwerking.', 4500, 45, 10, 'percentage', 25, true),
  ('Beard Trim', 'Baard trimmen, contouren en olie.', 2500, 25, 5, 'fixed', 500, true);

insert into public.availability_rules (weekday, opens_at, closes_at, is_active)
values
  (1, '09:00', '18:00', true),
  (2, '09:00', '18:00', true),
  (3, '09:00', '18:00', true),
  (4, '09:00', '20:00', true),
  (5, '09:00', '18:00', true),
  (6, '10:00', '16:00', true);

insert into public.products
  (name, description, price_cents, stock, is_active, image_paths)
values
  ('Matte Clay', 'Matte styling clay met sterke hold.', 1895, 12, true, array[]::text[]),
  ('Beard Oil', 'Voedende baardolie met subtiele geur.', 1495, 10, true, array[]::text[]),
  ('Aftershave Balm', 'Kalmerende balm na het scheren.', 1695, 8, true, array[]::text[]);
