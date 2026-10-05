-- Округление количеств до десятых на уровне базы: убирает "хвосты" вида
-- 0.30000000000000004, которые появлялись из-за арифметики с дробными числами
-- в JavaScript. При смене типа существующие значения округляются автоматически,
-- и новые значения тоже будут округляться при записи.

ALTER TABLE public.materials
  ALTER COLUMN qty_full TYPE NUMERIC(10,1),
  ALTER COLUMN qty_half TYPE NUMERIC(10,1),
  ALTER COLUMN qty_almost_empty TYPE NUMERIC(10,1),
  ALTER COLUMN qty_reserve TYPE NUMERIC(10,1),
  ALTER COLUMN qty_warehouse TYPE NUMERIC(10,1),
  ALTER COLUMN min_threshold TYPE NUMERIC(10,1);

ALTER TABLE public.material_transactions
  ALTER COLUMN delta TYPE NUMERIC(10,1);

ALTER TABLE public.material_usage_log
  ALTER COLUMN qty_exact TYPE NUMERIC(10,1);

ALTER TABLE public.purchase_requests
  ALTER COLUMN needed_qty TYPE NUMERIC(10,1),
  ALTER COLUMN available_qty TYPE NUMERIC(10,1);
