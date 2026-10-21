-- Своё число мест для конкретного слота расписания занятий (например, МК: 30 мест вместо 12).
-- Нет строки для слота — действует стандартное число (12).
CREATE TABLE IF NOT EXISTS public.slot_capacity (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date       DATE    NOT NULL,
  time       TEXT    NOT NULL,
  capacity   INTEGER NOT NULL CHECK (capacity >= 1 AND capacity <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, time)
);

ALTER TABLE public.slot_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON public.slot_capacity
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_capacity TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slot_capacity TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.slot_capacity_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.slot_capacity_id_seq TO service_role;
