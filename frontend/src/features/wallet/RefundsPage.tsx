import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { getRefunds } from "./api";
import { formatDateTime, formatInr } from "./format";

const PAGE_SIZE = 10;

export function RefundsPage() {
  const [offset, setOffset] = useState(0);
  const { data, error, isLoading } = useQuery({
    queryKey: ["refunds", offset],
    queryFn: () => getRefunds(PAGE_SIZE, offset),
  });

  return (
    <main className="page">
      <h1>Refunds</h1>
      <p className="lede">
        Cancellation refunds are credited to your <Link to="/wallet">wallet</Link> automatically.
      </p>
      {isLoading && <p role="status">Loading refunds…</p>}
      {error && <p className="error" role="alert">{errorMessage(error)}</p>}
      {data && data.items.length === 0 && <p className="empty">No refunds yet.</p>}
      {data && data.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Refund history</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">PNR</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="num">Refunded</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((refund) => (
                  <tr key={refund.refund_id}>
                    <td>{formatDateTime(refund.created_at)}</td>
                    <td><Link to={`/tickets/${refund.pnr}`}>{refund.pnr}</Link></td>
                    <td>{refund.reason}</td>
                    <td className="num credit">{formatInr(refund.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Newer
            </button>
            <span className="muted">
              {offset + 1}–{offset + data.items.length} of {data.total}
            </span>
            <button disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Older
            </button>
          </div>
        </>
      )}
    </main>
  );
}
