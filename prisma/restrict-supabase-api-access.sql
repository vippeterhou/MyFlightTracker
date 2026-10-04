-- Apply with separately authorized database-owner credentials, never at startup.
-- Flight Tracker uses Prisma as flighttracker_runtime, not Supabase's API roles.
-- This deliberately does not alter shared default privileges or Jiapu objects.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'TrackedFlight', 'FlightStatus', 'PollLog',
        'ApiCall', 'WorkerHeartbeat', 'TodoItem'
    ] LOOP
        IF NOT has_table_privilege(
            'flighttracker_runtime', format('public.%I', table_name), 'SELECT'
        ) THEN
            RAISE EXCEPTION 'Restricted runtime access must be configured first: %', table_name;
        END IF;
    END LOOP;
END
$$;

REVOKE ALL PRIVILEGES ON TABLE
    public."TrackedFlight",
    public."FlightStatus",
    public."PollLog",
    public."ApiCall",
    public."WorkerHeartbeat",
    public."TodoItem"
FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
    table_name text;
    api_role text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'TrackedFlight', 'FlightStatus', 'PollLog',
        'ApiCall', 'WorkerHeartbeat', 'TodoItem'
    ] LOOP
        FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
            IF has_table_privilege(
                api_role, format('public.%I', table_name),
                'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
            ) OR has_any_column_privilege(
                api_role, format('public.%I', table_name),
                'SELECT, INSERT, UPDATE, REFERENCES'
            ) THEN
                RAISE EXCEPTION 'Unexpected inherited or column-level access: % on %', api_role, table_name;
            END IF;
        END LOOP;
    END LOOP;
END
$$;

COMMIT;
