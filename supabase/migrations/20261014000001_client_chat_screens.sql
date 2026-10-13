-- Скрины переписок с клиентами в карточке клиента (для менеджеров, владельца и Салампи).
-- В отличие от фото учеников, доступ ограничен ролями на уровне базы:
-- педагоги (teacher) не могут ни читать, ни загружать скрины даже в обход интерфейса.

-- Закрытое хранилище, файл до 3 МБ (скрины сжимаются при загрузке до ~150-300 КБ)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-chats', 'client-chats', false, 3145728,
  ARRAY['image/jpeg', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Чтение и загрузка: admin, manager, accountmanager, supervisor
CREATE POLICY "client_chats_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-chats'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager', 'supervisor')
    )
  );

CREATE POLICY "client_chats_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-chats'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager', 'supervisor')
    )
  );

-- Удаление файлов: admin, manager, accountmanager (supervisor — нет, у Салампи удаление отключено)
CREATE POLICY "client_chats_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-chats'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager')
    )
  );

-- Таблица скринов
CREATE TABLE public.client_chat_screens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  size_bytes INTEGER,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_chat_screens_client_id_idx ON public.client_chat_screens (client_id);
CREATE INDEX client_chat_screens_created_at_idx ON public.client_chat_screens (created_at);

ALTER TABLE public.client_chat_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chats_select" ON public.client_chat_screens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager', 'supervisor')
  ));

CREATE POLICY "chats_insert" ON public.client_chat_screens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager', 'supervisor')
  ));

CREATE POLICY "chats_update" ON public.client_chat_screens
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager')
  ));

CREATE POLICY "chats_delete" ON public.client_chat_screens
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager', 'accountmanager')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_chat_screens TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.client_chat_screens_id_seq TO authenticated, service_role;
