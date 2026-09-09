-- Grant missing table-level privileges for the mailing tables.
-- RLS policies exist but without explicit GRANT the authenticated role hits
-- "permission denied" at the ACL level before RLS is even evaluated.
-- Same pattern as 20260810000001_teacher_feedback_grants.sql.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailing_statuses    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_mailings     TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailing_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailing_statuses    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_mailings     TO service_role;

-- Sequence usage so INSERT can auto-increment the SERIAL primary key
GRANT USAGE, SELECT ON SEQUENCE public.mailing_campaigns_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.mailing_statuses_id_seq    TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.client_mailings_id_seq     TO authenticated;
