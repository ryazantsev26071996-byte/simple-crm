-- Округление количеств до сотых (вместо десятых): 0.25 больше не превращается в 0.3.
-- Существующие значения сохраняются (десятые -> сотые без потерь).

ALTER TABLE public.materials
  ALTER COLUMN qty_full TYPE NUMERIC(10,2),
  ALTER COLUMN qty_half TYPE NUMERIC(10,2),
  ALTER COLUMN qty_almost_empty TYPE NUMERIC(10,2),
  ALTER COLUMN qty_reserve TYPE NUMERIC(10,2),
  ALTER COLUMN qty_warehouse TYPE NUMERIC(10,2),
  ALTER COLUMN min_threshold TYPE NUMERIC(10,2);

ALTER TABLE public.material_transactions
  ALTER COLUMN delta TYPE NUMERIC(10,2);

ALTER TABLE public.material_usage_log
  ALTER COLUMN qty_exact TYPE NUMERIC(10,2);

ALTER TABLE public.purchase_requests
  ALTER COLUMN needed_qty TYPE NUMERIC(10,2),
  ALTER COLUMN available_qty TYPE NUMERIC(10,2);
