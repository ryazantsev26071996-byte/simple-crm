-- Ограниченный аккаунт: arina@artschool.ru (роль accountmanager).
-- Защита на уровне БД, работает даже если обойти интерфейс CRM:
--   1) нигде не может удалять строки;
--   2) не может менять служебные таблицы (стадии, рассылки, материалы, график, слоты, профили, журнал).
-- Чтение клиентов НЕ закрывается: по решению владельца она видит всех клиентов.
-- Для других пользователей политики ничего не меняют.

-- 1) Запрет удаления во всех таблицах схемы public
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS restrict_arina_delete ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY restrict_arina_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''arina@artschool.ru'')',
      t.relname);
  END LOOP;
END $$;

-- 2) Запрет изменения служебных таблиц (чтение остаётся)
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND (c.relname IN ('client_stages','work_schedule','schedule_blocks','slot_capacity','profiles',
                         'purchase_requests','purchase_request_cycles')
           OR c.relname LIKE 'mailing%'
           OR c.relname LIKE 'material%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS restrict_arina_insert ON public.%I', t.relname);
    EXECUTE format('DROP POLICY IF EXISTS restrict_arina_update ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY restrict_arina_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''arina@artschool.ru'')',
      t.relname);
    EXECUTE format(
      'CREATE POLICY restrict_arina_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''arina@artschool.ru'')',
      t.relname);
  END LOOP;
END $$;

-- 3) Журнал изменений: менять нельзя (запись новых строк остаётся — CRM сама пишет журнал)
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS restrict_arina_update ON public.audit_log';
    EXECUTE 'CREATE POLICY restrict_arina_update ON public.audit_log AS RESTRICTIVE FOR UPDATE TO authenticated USING (lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''arina@artschool.ru'')';
  END IF;
END $$;
