-- Арина (arina@artschool.ru): считает материалы — разрешаем ей запись в таблицы материалов
-- (запрет удаления остаётся), и скрываем пробные занятия до ноября 2026.

-- 1) Материалы: снять запрет на INSERT/UPDATE (DELETE по-прежнему запрещён политикой restrict_arina_delete)
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (c.relname LIKE 'material%' OR c.relname IN ('purchase_requests','purchase_request_cycles'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS restrict_arina_insert ON public.%I', t.relname);
    EXECUTE format('DROP POLICY IF EXISTS restrict_arina_update ON public.%I', t.relname);
  END LOOP;
END $$;

-- 2) Пробные занятия: для Арины видны только записи с 2026-11-01 (защита на уровне базы)
DO $$
BEGIN
  IF to_regclass('public.trial_schedule') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS restrict_arina_select ON public.trial_schedule';
    EXECUTE 'CREATE POLICY restrict_arina_select ON public.trial_schedule AS RESTRICTIVE FOR SELECT TO authenticated USING (lower(coalesce(auth.jwt() ->> ''email'', '''')) <> ''arina@artschool.ru'' OR date >= ''2026-11-01'')';
  END IF;
END $$;
