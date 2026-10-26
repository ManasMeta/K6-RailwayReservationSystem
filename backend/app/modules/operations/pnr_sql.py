"""SQL for the public PNR status page. Reads only the v_pnr_status view."""

PNR_ROWS = """
SELECT pnr, reservation_status, train_no, train_name, run_date,
       from_station_code, from_station_name, to_station_code, to_station_name,
       class_code, quota_code, passenger_id, passenger_name, passenger_status,
       coach_code, berth_no, berth_type, rac_number, wl_number,
       run_status, delay_minutes, chart_prepared
FROM v_pnr_status
WHERE pnr = %(pnr)s
ORDER BY passenger_id
"""
