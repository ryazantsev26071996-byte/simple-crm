-- Чистка ошибочно загруженных строк: в исходной Excel-таблице названия
-- производителей красок (Ладога, Брауберг, Гамма и т.д.) стояли как
-- строки-разделители без самой краски за ними и были по ошибке
-- загружены в справочник материалов как отдельные позиции. Удаляем их.

DELETE FROM public.materials
WHERE category_id = (SELECT id FROM public.material_categories WHERE name = 'Масло')
  AND name IN ('Ладога', 'Брауберг', 'Мастер класс', 'Гамма', 'Виста артиста', 'изостудия', 'Малевич', 'Тициан');

DELETE FROM public.materials
WHERE category_id = (SELECT id FROM public.material_categories WHERE name = 'Акрил')
  AND name IN ('Брауберг 75 мл', 'ладога 75 мл', 'виста артиста 75 мл', 'Гамма', 'сонет 75 мл');

DELETE FROM public.materials
WHERE category_id = (SELECT id FROM public.material_categories WHERE name = 'Акварель')
  AND name IN ('Брауберг', 'Белые ночи');
