-- Позволяет свернуть выполненный цикл заявок на закупку в одну строку
-- ("Заказ ... от ...") вместо того чтобы держать развёрнутый список
-- вечно на экране после того, как всё куплено.

CREATE TABLE public.purchase_request_cycles (
  cycle_label TEXT PRIMARY KEY,
  archived BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_request_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.purchase_request_cycles FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_request_cycles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_request_cycles TO service_role;
