import React from "react";
import type { FareBreakdown } from "./types";

interface FareBreakupModalProps {
  fare: FareBreakdown | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FareBreakupModal({ fare, isOpen, onClose }: FareBreakupModalProps) {
  if (!isOpen || !fare) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="fare-modal-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2 id="fare-modal-title">Fare Breakup — {fare.class_code} ({fare.quota_code})</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <div className="fare-metric">
            <span className="muted">Total Distance</span>
            <strong>{fare.distance_km} km</strong>
          </div>

          <table className="fare-table">
            <tbody>
              <tr>
                <td>Base Fare</td>
                <td className="amount">₹{Number(fare.base_fare).toFixed(2)}</td>
              </tr>
              {Number(fare.concession_discount) > 0 && (
                <tr className="discount-row">
                  <td>Concession Discount ({fare.concession_code})</td>
                  <td className="amount">-₹{Number(fare.concession_discount).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td>Reservation Charge</td>
                <td className="amount">₹{Number(fare.reservation_fee).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Superfast Surcharge</td>
                <td className="amount">₹{Number(fare.superfast_charge).toFixed(2)}</td>
              </tr>
              {Number(fare.tatkal_charge) > 0 && (
                <tr>
                  <td>Tatkal Surcharge</td>
                  <td className="amount">₹{Number(fare.tatkal_charge).toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td>GST (Goods & Services Tax)</td>
                <td className="amount">₹{Number(fare.gst).toFixed(2)}</td>
              </tr>
              <tr className="total-row">
                <td><strong>Total Fare</strong></td>
                <td className="amount"><strong>₹{Number(fare.total_fare).toFixed(2)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>

        <footer className="modal-footer">
          <button type="button" className="primary" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
