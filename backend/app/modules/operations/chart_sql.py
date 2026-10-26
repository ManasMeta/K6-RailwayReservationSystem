"""SQL for charts. The real work is done by the prepare_chart() function in the database."""

PREPARE_CHART = """
SELECT o_chart_id          AS chart_id,
       o_promoted          AS promoted,
       o_remaining_rac     AS remaining_rac,
       o_remaining_wl      AS remaining_wl,
       o_final_vacant_berths AS final_vacant_berths,
       o_already_prepared  AS already_prepared
FROM prepare_chart(%(run_id)s, %(user_id)s)
"""

GET_CHART = """
SELECT chart_id, run_id, prepared_at, final_vacant_berths
FROM charts
WHERE run_id = %(run_id)s
"""

CHART_ENTRIES = """
SELECT ce.passenger_id, r.pnr, rp.passenger_name AS name, rp.current_status AS status,
       ce.coach_code, ce.berth_no, ce.berth_type, ce.quota_code
FROM chart_entries ce
JOIN reservation_passengers rp ON rp.passenger_id = ce.passenger_id
JOIN reservations r ON r.reservation_id = rp.reservation_id
WHERE ce.chart_id = %(chart_id)s
ORDER BY ce.coach_code NULLS LAST, ce.berth_no NULLS LAST, ce.passenger_id
"""
