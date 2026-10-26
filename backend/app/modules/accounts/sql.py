# Role priority follows roles.role_id: passenger=1, staff=2, admin=3.
USER_COLUMNS = """
    u.user_id, u.email::text AS email, u.full_name, u.phone, u.password_hash,
    COALESCE((
        SELECT r.role_name FROM user_roles ur JOIN roles r USING (role_id)
        WHERE ur.user_id = u.user_id ORDER BY r.role_id DESC LIMIT 1
    ), 'passenger') AS role
"""

INSERT_USER = """
    INSERT INTO users (email, password_hash, full_name, phone)
    VALUES (%s, %s, %s, %s)
    RETURNING user_id
"""

INSERT_PASSENGER_ROLE = """
    INSERT INTO user_roles (user_id, role_id)
    SELECT %s::bigint, role_id FROM roles WHERE role_name = 'passenger'
"""

GET_USER_BY_EMAIL = f"SELECT {USER_COLUMNS} FROM users u WHERE u.email = %s"

GET_USER_BY_ID = f"SELECT {USER_COLUMNS} FROM users u WHERE u.user_id = %s"

UPDATE_PROFILE = "UPDATE users SET full_name = %s, phone = %s WHERE user_id = %s"

LOCK_USER = "SELECT 1 FROM users WHERE user_id = %s FOR UPDATE"

COUNT_PASSENGERS = "SELECT count(*) AS n FROM saved_passengers WHERE user_id = %s"

PASSENGER_COLUMNS = (
    "passenger_id, user_id, full_name, age, gender, berth_preference, senior_citizen"
)

LIST_PASSENGERS = (
    f"SELECT {PASSENGER_COLUMNS} FROM saved_passengers WHERE user_id = %s ORDER BY passenger_id"
)

INSERT_PASSENGER = f"""
    INSERT INTO saved_passengers (user_id, full_name, age, gender, berth_preference, senior_citizen)
    VALUES (%s, %s, %s, %s, %s, %s)
    RETURNING {PASSENGER_COLUMNS}
"""

DELETE_PASSENGER = (
    "DELETE FROM saved_passengers WHERE passenger_id = %s AND user_id = %s RETURNING passenger_id"
)
