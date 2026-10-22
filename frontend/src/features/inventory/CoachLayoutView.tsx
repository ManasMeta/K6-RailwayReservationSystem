import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchCoachLayout, fetchTrainCoaches } from "./api";

interface CoachLayoutViewProps {
  trainNo: string;
  runDate: string;
}

export function CoachLayoutView({ trainNo, runDate }: CoachLayoutViewProps) {
  const { data: coaches, isLoading: loadingCoaches } = useQuery({
    queryKey: ["coaches", trainNo],
    queryFn: () => fetchTrainCoaches(trainNo),
  });

  const [selectedCoachId, setSelectedCoachId] = useState<number | null>(null);

  // Automatically select the first coach once loaded
  const activeCoachId = selectedCoachId ?? (coaches && coaches.length > 0 ? coaches[0].coach_id : null);

  const { data: layout, isLoading: loadingLayout } = useQuery({
    queryKey: ["coach-layout", activeCoachId, runDate],
    queryFn: () => fetchCoachLayout(activeCoachId!, runDate),
    enabled: Boolean(activeCoachId),
  });

  if (loadingCoaches) {
    return <p className="muted">Loading train coaches...</p>;
  }

  if (!coaches || coaches.length === 0) {
    return <p className="muted">No coach layout data available for train {trainNo}.</p>;
  }

  return (
    <div className="coach-layout-container">
      <div className="coach-selector">
        <label htmlFor="coach-select"><strong>Select Coach:</strong></label>
        <div className="coach-pills">
          {coaches.map((c) => (
            <button
              key={c.coach_id}
              type="button"
              className={`pill ${activeCoachId === c.coach_id ? "active" : ""}`}
              onClick={() => setSelectedCoachId(c.coach_id)}
            >
              {c.coach_code} ({c.class_code})
            </button>
          ))}
        </div>
      </div>

      {loadingLayout && <p className="muted">Loading berth occupancy map...</p>}

      {layout && (
        <div className="coach-schematic">
          <div className="coach-header">
            <h4>Coach {layout.coach_code} ({layout.class_code}) — {layout.total_berths} Berths</h4>
            <div className="legend">
              <span className="legend-item"><span className="berth-indicator available" /> Free</span>
              <span className="legend-item"><span className="berth-indicator booked" /> Booked</span>
            </div>
          </div>

          <div className="berths-grid">
            {layout.berths.map((b) => (
              <div
                key={b.berth_id}
                className={`berth-cell ${b.is_available ? "is-available" : "is-booked"}`}
                title={`Berth ${b.berth_number} (${b.berth_type}): ${b.is_available ? "Available" : "Occupied"}`}
              >
                <span className="berth-number">{b.berth_number}</span>
                <span className="berth-type">{b.berth_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
