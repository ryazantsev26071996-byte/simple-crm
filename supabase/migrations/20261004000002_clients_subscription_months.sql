-- Срок абонемента в месяцах. Для стандартных абонементов (Отдыхай/Изучай/Покоряй)
-- срок известен по названию, а для "Индивидуальных условий" он вводится вручную
-- и раньше нигде не сохранялся — из-за этого не считалась дата окончания
-- (и дата окончания с учётом заморозок).

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS subscription_months INTEGER;

-- Восстанавливаем срок там, где даты начала и окончания уже есть.
UPDATE public.clients
SET subscription_months = GREATEST(1, ROUND((subscription_end::date - subscription_start::date) / 30.44))
WHERE subscription_type = 'Индивидуальные условия'
  AND subscription_months IS NULL
  AND subscription_start IS NOT NULL
  AND subscription_end IS NOT NULL;
