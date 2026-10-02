-- Расход материалов на занятиях.
--
-- Два режима учёта материала (поле tracking_mode):
--   точный    — холсты, бумага, карандаши, кисти и т.п. Списывается ровно
--               столько, сколько указал педагог, напрямую из qty_full
--               (с записью в material_transactions).
--   оценочный — краски (их нельзя точно отмерить "на глазок"). Педагог
--               выбирает качественную оценку (капля/горошина/полтюбика/
--               тюбик), запись просто накапливается в material_usage_log
--               для последующей аналитики и сверки с инвентаризацией —
--               остаток материала (qty_full и т.д.) этим НЕ затрагивается,
--               он по-прежнему меняется только вручную при пересчёте.

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'точный';

UPDATE public.materials SET tracking_mode = 'оценочный'
WHERE category_id IN (
  SELECT id FROM public.material_categories
  WHERE name IN ('Масло', 'Акрил', 'Гуашь', 'Акварель', 'Акрил по ткани')
);

CREATE TABLE public.material_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lesson_date DATE,
  schedule_id BIGINT REFERENCES public.schedule(id) ON DELETE SET NULL,
  client_id BIGINT REFERENCES public.clients(id),
  material_id BIGINT NOT NULL REFERENCES public.materials(id),
  mode TEXT NOT NULL, -- точный | оценочный
  qty_exact NUMERIC,
  qualitative_unit TEXT, -- капля | горошина | полтюбика | тюбик
  qualitative_weight NUMERIC, -- вес единицы на момент записи (чтобы будущие правки шкалы не меняли историю)
  teacher_name TEXT,
  created_by UUID,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.material_usage_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_usage_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_usage_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.material_usage_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.material_usage_log_id_seq TO service_role;
