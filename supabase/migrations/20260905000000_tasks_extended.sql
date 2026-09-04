-- Extend tasks table with Bitrix24-style fields
-- (task_comments table is created in 20260905000001_task_comments.sql)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by        uuid,
  ADD COLUMN IF NOT EXISTS created_by_name   text,
  ADD COLUMN IF NOT EXISTS co_executors      text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS observers         text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_important      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_required   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS completion_report text;
