ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority     text DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS due_time     text,
  ADD COLUMN IF NOT EXISTS repeat_type  text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS repeat_until date,
  ADD COLUMN IF NOT EXISTS status       text DEFAULT 'new';
