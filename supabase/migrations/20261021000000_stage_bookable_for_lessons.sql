-- Галочка у стадии клиента: можно ли записывать клиентов этой стадии на занятия в расписании
-- (например, стадия "МК Хэллоуин": люди без абонемента записываются на мероприятие).
ALTER TABLE public.client_stages
  ADD COLUMN IF NOT EXISTS bookable_for_lessons BOOLEAN NOT NULL DEFAULT false;

-- Сейчас записывать на занятия можно только стадию "ученик" — сохраняем это поведение.
UPDATE public.client_stages SET bookable_for_lessons = true WHERE name = 'ученик';
