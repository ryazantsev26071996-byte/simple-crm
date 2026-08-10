create table public.teacher_feedback (
  id bigint generated always as identity primary key,
  teacher_name text not null,
  student_name text,
  rating smallint check (rating between 1 and 5),
  text text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved')),
  author_id uuid references auth.users,
  author_name text,
  created_at timestamptz not null default now()
);

alter table public.teacher_feedback enable row level security;

create policy "authenticated can select teacher_feedback"
  on public.teacher_feedback for select
  to authenticated
  using (true);

create policy "authenticated can insert teacher_feedback"
  on public.teacher_feedback for insert
  to authenticated
  with check (true);

create policy "authenticated can update teacher_feedback"
  on public.teacher_feedback for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can delete teacher_feedback"
  on public.teacher_feedback for delete
  to authenticated
  using (true);
