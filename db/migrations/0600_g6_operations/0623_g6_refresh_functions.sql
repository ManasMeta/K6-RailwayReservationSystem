-- Author: G6-Backend (G6 Member 2)
-- Description: let the API role refresh the report views.
--
-- REFRESH MATERIALIZED VIEW needs ownership of the view, and the API connects as nrrms_app,
-- which does not own it. These SECURITY DEFINER wrappers run as the migrating role, which does.
-- CONCURRENTLY keeps the old rows readable while the new ones are built.
CREATE OR REPLACE FUNCTION refresh_mv_occupancy() RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_occupancy;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_mv_revenue() RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue;
END;
$$;

REVOKE ALL ON FUNCTION refresh_mv_occupancy(), refresh_mv_revenue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_mv_occupancy(), refresh_mv_revenue() TO nrrms_app;
