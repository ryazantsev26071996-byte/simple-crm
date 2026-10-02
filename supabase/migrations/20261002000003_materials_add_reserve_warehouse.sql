-- "в запасе" (чемоданчик в студии, куда преподаватели докладывают краски, когда
-- основной запас кончается) был по ошибке объединён с основным остатком (qty_full)
-- при первой загрузке — это отдельная величина, восстанавливаем как отдельное поле.
-- Также добавляем поле "на складе" (запас красок на другом объекте) — данных по нему
-- в исходной таблице не было, поле добавляется пустым для заполнения вручную.

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS qty_reserve NUMERIC;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS qty_warehouse NUMERIC;

-- Масло
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM public.materials
  WHERE category_id = (SELECT id FROM public.material_categories WHERE name = 'Масло')
),
reserves(rn, qty_reserve) AS (
  VALUES
    (1, NULL),
    (2, NULL),
    (3, NULL),
    (4, NULL),
    (5, NULL),
    (6, NULL),
    (7, NULL),
    (8, 1.0),
    (9, NULL),
    (10, NULL),
    (11, NULL),
    (12, NULL),
    (13, 2.0),
    (14, NULL),
    (15, NULL),
    (16, NULL),
    (17, 1.0),
    (18, 1.0),
    (19, NULL),
    (20, 1.0),
    (21, NULL),
    (22, 2.0),
    (23, 2.0),
    (24, 1.0),
    (25, 1.0),
    (26, 1.0),
    (27, NULL),
    (28, NULL),
    (29, 1.0),
    (30, NULL),
    (31, 2.0),
    (32, 2.0),
    (33, 1.0),
    (34, NULL),
    (35, 1.0),
    (36, NULL),
    (37, 1.0),
    (38, NULL),
    (39, NULL),
    (40, 1.0),
    (41, NULL),
    (42, NULL),
    (43, NULL),
    (44, NULL),
    (45, NULL),
    (46, 1.0),
    (47, 1.0),
    (48, 1.0),
    (49, NULL),
    (50, NULL),
    (51, NULL),
    (52, NULL),
    (53, NULL),
    (54, NULL),
    (55, NULL),
    (56, NULL),
    (57, NULL),
    (58, NULL),
    (59, NULL),
    (60, NULL),
    (61, NULL),
    (62, NULL),
    (63, NULL),
    (64, 1.0),
    (65, NULL),
    (66, NULL)
)
UPDATE public.materials m SET qty_reserve = r.qty_reserve
FROM ordered o JOIN reserves r ON o.rn = r.rn
WHERE m.id = o.id;

-- Акрил
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM public.materials
  WHERE category_id = (SELECT id FROM public.material_categories WHERE name = 'Акрил')
),
reserves(rn, qty_reserve) AS (
  VALUES
    (1, NULL),
    (2, NULL),
    (3, 2.0),
    (4, NULL),
    (5, NULL),
    (6, NULL),
    (7, 2.0),
    (8, NULL),
    (9, NULL),
    (10, NULL),
    (11, 2.0),
    (12, NULL),
    (13, NULL),
    (14, NULL),
    (15, NULL),
    (16, NULL),
    (17, NULL),
    (18, 1.0),
    (19, 1.0),
    (20, 1.0),
    (21, NULL),
    (22, NULL),
    (23, NULL),
    (24, 1.0),
    (25, NULL),
    (26, 2.0),
    (27, 3.0),
    (28, NULL),
    (29, NULL),
    (30, 1.0),
    (31, 1.0),
    (32, 2.0),
    (33, 1.0),
    (34, NULL),
    (35, 1.0),
    (36, NULL),
    (37, NULL),
    (38, NULL),
    (39, NULL),
    (40, NULL),
    (41, NULL),
    (42, NULL),
    (43, NULL),
    (44, NULL),
    (45, NULL),
    (46, NULL),
    (47, NULL),
    (48, NULL),
    (49, 0.5),
    (50, 0.5),
    (51, 1.0),
    (52, 1.0),
    (53, 1.0),
    (54, 1.0),
    (55, 1.0),
    (56, NULL),
    (57, NULL),
    (58, NULL),
    (59, NULL)
)
UPDATE public.materials m SET qty_reserve = r.qty_reserve
FROM ordered o JOIN reserves r ON o.rn = r.rn
WHERE m.id = o.id;
