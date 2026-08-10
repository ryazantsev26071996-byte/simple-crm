-- Grant DML privileges that Supabase Studio adds automatically but raw
-- migrations skip. Without these the authenticated role hits "permission
-- denied" even when RLS policies allow access.
grant select, insert, update, delete on public.teacher_feedback to authenticated;
grant select, insert, update, delete on public.teacher_feedback to service_role;
