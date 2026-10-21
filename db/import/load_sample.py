"""CI helper: import the small G2 fixture (db/seeds/g2_train_details_sample.csv).

The real file is loaded with load_train_details.py; CI uses a 500-row sample
of the same layout.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from load_train_details import main

SAMPLE = Path(__file__).resolve().parents[1] / "seeds" / "g2_train_details_sample.csv"

if __name__ == "__main__":
    main([str(SAMPLE), *sys.argv[1:]])
