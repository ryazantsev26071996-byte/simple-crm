-- Kanban stage list, previously hardcoded in the frontend.
-- Pattern mirrors mailing_campaigns: RLS + explicit grants so the
-- authenticated role can do full CRUD via PostgREST.

CREATE TABLE public.client_stages (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             TEXT    NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  visible_to_teacher BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON public.client_stages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_stages TO service_role;

-- Identity columns use an internal sequence that still needs explicit grants
-- for PostgREST INSERT to succeed (same fix applied to mailing_* tables).
GRANT USAGE, SELECT ON SEQUENCE public.client_stages_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.client_stages_id_seq TO service_role;

-- Seed: 17 stages in canonical order, visible_to_teacher true only for
-- the three stages teachers can see on the board.
INSERT INTO public.client_stages (name, sort_order, visible_to_teacher) VALUES
  ('новая заявка',         0,  false),
  ('ндз',                  1,  false),
  ('записан на пробное',   2,  false),
  ('на следующий месяц',   3,  false),
  ('был не купил',         4,  false),
  ('не пришел',            5,  false),
  ('дожимать',             6,  false),
  ('продажа',              7,  false),
  ('ученик',               8,  true),
  ('бронь',                9,  false),
  ('тест-драйв',           10, true),
  ('пробный месяц',        11, true),
  ('рассылка',             12, false),
  ('на МК или ОД',         13, false),
  ('корявый лид',          14, false),
  ('расторжение',          15, false),
  ('кончился абонемент',   16, false);
