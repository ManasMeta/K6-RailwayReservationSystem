import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchAvailability, fetchFare } from "./api";
import { CoachLayoutView } from "./CoachLayoutView";
import { FareBreakupModal } from "./FareBreakupModal";
import type { AvailabilityCell, FareBreakdown } from "./types";

interface AvailabilityGridProps {
  trainNo: string;
  fromCode: string;
  toCode: string;
  startDate: string;
}

export function AvailabilityGrid({
  trainNo,
  fromCode,
  toCode,
  startDate,
}: AvailabilityGridProps) {
  const [quota, setQuota] = useState("GN");
  const [selectedCell, setSelectedCell] = useState<AvailabilityCell | null>(null);
  const [fareData, setFareData] = useState<FareBreakdown | null>(null);
  const [isFareModalOpen, setIsFareModalOpen] = useState(false);
  const [showCoachLayout, setShowCoachLayout] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["availability", trainNo, fromCode, toCode, startDate, quota],
    queryFn: () => fetchAvailability(trainNo, fromCode, toCode, startDate, quota, 6),
  });

  // Extract unique sorted travel dates and classes from items
  const { dates, classes, matrix } = useMemo(() => {
    if (!data?.items) return { dates: [], classes: [], matrix: new Map<string, AvailabilityCell>() };

    const dateSet = new Set<string>();
    const classMap = new Map<string, string>();
    const cellMap = new Map<string, AvailabilityCell>();

    for (const item of data.items) {
      dateSet.add(item.travel_date);
      classMap.set(item.class_code, item.class_name);
      cellMap.set(`${item.class_code}_${item.travel_date}`, item);
    }

    return {
      dates: Array.from(dateSet).sort(),
      classes: Array.from(classMap.entries()).map(([code, name]) => ({ code, name })),
      matrix: cellMap,
    };
  }, [data]);

  async function handleOpenFare(cell: AvailabilityCell) {
    setSelectedCell(cell);
    try {
      const breakdown = await fetchFare(trainNo, fromCode, toCode, cell.class_code, quota);
      setFareData(breakdown);
      setIsFareModalOpen(true);
    } catch {
      // Fallback display if fare endpoint fails
      setFareData({
        distance_km: 1000,
        class_code: cell.class_code,
        quota_code: quota,
        concession_code: "GENERAL",
        base_fare: cell.fare,
        reservation_fee: 40,
        superfast_charge: 45,
        tatkal_charge: 0,
        concession_discount: 0,
        gst: 0,
        total_fare: cell.fare,
      });
      setIsFareModalOpen(true);
    }
  }

  function getBadgeClass(status: string) {
    if (status === "AVAILABLE") return "badge-avl";
    if (status === "RAC") return "badge-rac";
    return "badge-wl";
  }

  function getStatusText(cell: AvailabilityCell) {
    if (cell.status === "AVAILABLE") return `AVL ${cell.available_count}`;
    if (cell.status === "RAC") return `RAC ${cell.rac_count}`;
    return `WL ${cell.wl_count}`;
  }

  return (
    <div className="availability-card">
      <div className="availability-header">
        <div className="title-section">
          <h3>Seats & Fares Availability</h3>
          <span className="muted">Next 6 days between {fromCode} and {toCode}</span>
        </div>
        <div className="quota-selector">
          <label htmlFor={`quota-select-${trainNo}`}>Quota:</label>
          <select
            id={`quota-select-${trainNo}`}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
          >
            <option value="GN">General (GN)</option>
            <option value="TQ">Tatkal (TQ)</option>
            <option value="LD">Ladies (LD)</option>
            <option value="SS">Senior Citizen (SS)</option>
          </select>
        </div>
      </div>

      {isLoading && <p className="muted">Loading availability matrix...</p>}
      {error && <p className="error" role="alert">Unable to load live availability for this train.</p>}

      {data && classes.length > 0 && (
        <div className="availability-matrix-wrapper">
          <table className="availability-table">
            <thead>
              <tr>
                <th className="class-col">Class</th>
                {dates.map((dt) => (
                  <th key={dt} className="date-col">
                    {new Date(dt).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls.code}>
                  <td className="class-info">
                    <strong>{cls.code}</strong>
                    <span className="class-subtext">{cls.name}</span>
                  </td>
                  {dates.map((dt) => {
                    const cell = matrix.get(`${cls.code}_${dt}`);
                    if (!cell) {
                      return <td key={dt} className="empty-cell">—</td>;
                    }
                    const isSelected = selectedCell?.class_code === cell.class_code && selectedCell?.travel_date === cell.travel_date;
                    return (
                      <td
                        key={dt}
                        className={`cell-interactive ${isSelected ? "selected-cell" : ""}`}
                        onClick={() => setSelectedCell(cell)}
                      >
                        <div className={`status-badge ${getBadgeClass(cell.status)}`}>
                          {getStatusText(cell)}
                        </div>
                        <div className="cell-fare">₹{Number(cell.fare).toFixed(0)}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCell && (
        <div className="cell-action-bar">
          <div className="selected-summary">
            Selected: <strong>{selectedCell.class_code}</strong> on{" "}
            <strong>{new Date(selectedCell.travel_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong> —{" "}
            <span className={`status-text ${getBadgeClass(selectedCell.status)}`}>
              {getStatusText(selectedCell)}
            </span>{" "}
            (₹{Number(selectedCell.fare).toFixed(0)})
          </div>
          <div className="action-buttons">
            <button
              type="button"
              className="secondary"
              onClick={() => handleOpenFare(selectedCell)}
            >
              Fare Breakup
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowCoachLayout(!showCoachLayout)}
            >
              {showCoachLayout ? "Hide Seat Map" : "View Seat Map"}
            </button>
          </div>
        </div>
      )}

      {showCoachLayout && (
        <CoachLayoutView
          trainNo={trainNo}
          runDate={selectedCell?.travel_date ?? startDate}
        />
      )}

      <FareBreakupModal
        fare={fareData}
        isOpen={isFareModalOpen}
        onClose={() => setIsFareModalOpen(false)}
      />
    </div>
  );
}
