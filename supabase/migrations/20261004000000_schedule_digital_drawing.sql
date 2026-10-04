-- Отметка "цифровой рисунок" для занятия: на таких занятиях физические
-- материалы не расходуются, поэтому блок "Материалы" перестаёт быть
-- обязательным к заполнению.

ALTER TABLE public.schedule ADD COLUMN IF NOT EXISTS digital_drawing BOOLEAN NOT NULL DEFAULT false;
