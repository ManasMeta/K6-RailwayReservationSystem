-- Author: G3 frontend & database (Manas)
-- Availability grid set-returning function.
-- Generates series of travel dates CROSS JOIN active train classes.

CREATE OR REPLACE FUNCTION availability_grid(
    p_train_no TEXT,
    p_from_code TEXT,
    p_to_code TEXT,
    p_start_date DATE,
    p_days INT DEFAULT 6,
    p_quota TEXT DEFAULT 'GN'
)
RETURNS TABLE (
    travel_date DATE,
    class_code VARCHAR(5),
    class_name TEXT,
    status VARCHAR(15),
    available_count INT,
    rac_count INT,
    wl_count INT,
    fare NUMERIC(10,2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_train_id BIGINT;
    v_from_seq INT;
    v_to_seq INT;
BEGIN
    -- 1. Identify train and stop sequences
    SELECT t.train_id INTO v_train_id
    FROM trains t WHERE t.train_no = p_train_no;

    IF v_train_id IS NULL THEN
        RETURN;
    END IF;

    SELECT s.seq INTO v_from_seq
    FROM train_stops s
    JOIN stations st ON st.station_id = s.station_id
    WHERE s.train_id = v_train_id AND st.station_code = p_from_code;

    SELECT s.seq INTO v_to_seq
    FROM train_stops s
    JOIN stations st ON st.station_id = s.station_id
    WHERE s.train_id = v_train_id AND st.station_code = p_to_code;

    IF v_from_seq IS NULL OR v_to_seq IS NULL OR v_from_seq >= v_to_seq THEN
        RETURN;
    END IF;

    -- Ensure train has coaches generated
    PERFORM generate_train_consist_coaches(v_train_id);

    -- 2. Return cross join of generated dates and classes
    RETURN QUERY
    WITH dates AS (
        SELECT (p_start_date + (i || ' day')::INTERVAL)::DATE AS dt
        FROM generate_series(0, p_days - 1) AS i
    ),
    active_classes AS (
        SELECT DISTINCT c.class_code, tc.name AS class_name
        FROM coaches c
        JOIN travel_classes tc ON tc.class_code = c.class_code
        WHERE c.train_id = v_train_id
    ),
    grid_matrix AS (
        SELECT d.dt, ac.class_code, ac.class_name
        FROM dates d
        CROSS JOIN active_classes ac
    )
    SELECT 
        gm.dt AS travel_date,
        gm.class_code,
        gm.class_name,
        CASE 
            WHEN (
                (SELECT count(*) FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                - (SELECT count(*) FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
            ) > 0 THEN 'AVAILABLE'
            WHEN (
                (SELECT count(*) FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                - (SELECT count(*) FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
            ) >= -8 THEN 'RAC'
            ELSE 'WL'
        END AS status,
        GREATEST(0, (
            (SELECT count(*)::INT FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
            - (SELECT count(*)::INT FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
        )) AS available_count,
        CASE 
            WHEN (
                (SELECT count(*) FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                - (SELECT count(*) FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
            ) BETWEEN -8 AND 0 THEN
                ABS(
                    (SELECT count(*)::INT FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                    - (SELECT count(*)::INT FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
                ) + 1
            ELSE 0
        END AS rac_count,
        CASE 
            WHEN (
                (SELECT count(*) FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                - (SELECT count(*) FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
            ) < -8 THEN
                ABS(
                    (SELECT count(*)::INT FROM berths b JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code)
                    - (SELECT count(*)::INT FROM berth_allocations ba JOIN berths b ON b.berth_id = ba.berth_id JOIN coaches c ON c.coach_id = b.coach_id WHERE c.train_id = v_train_id AND c.class_code = gm.class_code AND ba.run_date = gm.dt AND ba.stops && int4range(v_from_seq, v_to_seq, '[)'))
                ) - 8
            ELSE 0
        END AS wl_count,
        COALESCE((SELECT cf.total FROM calculate_fare(v_train_id, v_from_seq, v_to_seq, gm.class_code, p_quota) cf), 0.00) AS fare
    FROM grid_matrix gm
    ORDER BY gm.dt, gm.class_code;
END;
$$;
