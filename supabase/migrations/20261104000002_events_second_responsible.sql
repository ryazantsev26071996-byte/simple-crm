-- Мероприятия: второй ответственный (любой сотрудник).
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS second_responsible TEXT;
