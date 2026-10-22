-- Author: G3 database (Manas)
-- Free berths calculation function for a segment.
-- Uses NOT EXISTS against berth_allocations using range overlap operator (&&).

CREATE OR REPLACE FUNCTION free_berths(
    p_train_id BIGINT,
    p_run_date DATE,
    p_from_seq INT,
    p_to_seq INT,
    p_class_code VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    berth_id BIGINT,
    coach_id BIGINT,
    coach_code VARCHAR(10),
    class_code VARCHAR(5),
    berth_number INT,
    berth_type VARCHAR(5)
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.berth_id,
        c.coach_id,
        c.coach_code,
        c.class_code,
        b.berth_number,
        b.berth_type
    FROM berths b
    JOIN coaches c ON c.coach_id = b.coach_id
    WHERE c.train_id = p_train_id
      AND (p_class_code IS NULL OR c.class_code = p_class_code)
      AND NOT EXISTS (
          SELECT 1 
          FROM berth_allocations ba
          WHERE ba.berth_id = b.berth_id
            AND ba.run_date = p_run_date
            AND ba.stops && int4range(p_from_seq, p_to_seq, '[)')
      )
    ORDER BY c.coach_code, b.berth_number;
END;
$$;
