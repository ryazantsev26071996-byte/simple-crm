-- Grant sequence usage to service_role so server-side scripts can INSERT
-- into the mailing tables. Tables with INTEGER SERIAL require explicit
-- sequence grants; tables using UUID or BIGINT generated keys do not.
GRANT USAGE, SELECT ON SEQUENCE public.mailing_campaigns_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.mailing_statuses_id_seq    TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.client_mailings_id_seq     TO service_role;
