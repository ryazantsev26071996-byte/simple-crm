-- Фото учеников в карточке клиента (несколько фото на ученика, например мама и дочь).
-- Файлы хранятся в закрытом хранилище (bucket client-photos), в таблице — только пути и подписи.

-- 1) Закрытое хранилище: прямых публичных ссылок нет, доступ только из CRM по временным ссылкам.
--    Лимит файла 3 МБ (фото сжимаются при загрузке до ~200-300 КБ), только изображения.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-photos', 'client-photos', false, 3145728,
  ARRAY['image/jpeg', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client_photos_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'client-photos');
CREATE POLICY "client_photos_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-photos');
CREATE POLICY "client_photos_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'client-photos');

-- 2) Таблица фото: у одного клиента может быть несколько записей.
CREATE TABLE public.client_photos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  size_bytes INTEGER,
  uploaded_by UUID,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_photos_client_id_idx ON public.client_photos (client_id);

ALTER TABLE public.client_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.client_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_photos TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.client_photos_id_seq TO authenticated, service_role;
