-- Прогресс ученика в карточке клиента:
--   1) Арт-сквиз: общая отметка "пройден" + отметки по 10 темам
--   2) Итоги по месяцам абонемента: отметка "N месяц пройден" + выводы
--      (что пройдено / что не пройдено / что дальше / переписывать ли стратегию)
-- Наличие строки = пункт отмечен; снятие галочки = удаление строки.

CREATE TABLE public.student_artsquiz (
  client_id BIGINT PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.student_artsquiz_topics (
  client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  topic_no INTEGER NOT NULL,
  checked_by_name TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, topic_no)
);

CREATE TABLE public.student_month_reviews (
  client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month_no INTEGER NOT NULL,
  covered TEXT,
  not_covered TEXT,
  next_steps TEXT,
  rewrite_strategy BOOLEAN NOT NULL DEFAULT false,
  done_by_name TEXT,
  done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, month_no)
);

ALTER TABLE public.student_artsquiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_artsquiz_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_month_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON public.student_artsquiz FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.student_artsquiz_topics FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.student_month_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_artsquiz TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_artsquiz_topics TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_month_reviews TO authenticated, service_role;
