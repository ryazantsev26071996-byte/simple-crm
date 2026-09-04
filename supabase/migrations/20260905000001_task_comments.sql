-- task_comments: task_id references tasks(id) which is integer
CREATE TABLE IF NOT EXISTS public.task_comments (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     integer     NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id   uuid,
  author_name text,
  text        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_task_comments_all"
    ON public.task_comments FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO service_role;
