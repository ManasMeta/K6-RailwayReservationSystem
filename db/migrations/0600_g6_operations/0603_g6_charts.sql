-- Author: G6-DB (G6 Member 3)
-- Description: charts - the final chart of a run; at most one per run
CREATE TABLE IF NOT EXISTS charts (
    chart_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_id               BIGINT NOT NULL UNIQUE REFERENCES train_runs (run_id),
    prepared_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    prepared_by          BIGINT REFERENCES users (user_id),
    final_vacant_berths  INT NOT NULL DEFAULT 0 CHECK (final_vacant_berths >= 0),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
