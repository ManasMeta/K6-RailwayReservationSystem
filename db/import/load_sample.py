"""CI helper: import the G2 sample timetable (db/seeds/g2_train_details_sample.csv).

The real file is loaded with load_train_details.py; CI uses a 1,899-row sample
of the same layout: 6 hand-written trains that the tests assert on, then
generated trains on real corridors.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from load_train_details import main

SAMPLE = Path(__file__).resolve().parents[1] / "seeds" / "g2_train_details_sample.csv"

if __name__ == "__main__":
    main([str(SAMPLE), *sys.argv[1:]])
