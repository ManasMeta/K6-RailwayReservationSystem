import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { getTicket, getTicketPdf, getTicketQr } from "./api";
import { formatDateTime, formatInr } from "./format";

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

export function TicketPage() {
  const { pnr = "" } = useParams();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const ticket = useQuery({ queryKey: ["ticket", pnr], queryFn: () => getTicket(pnr), enabled: pnr !== "" });
  const qr = useQuery({
    queryKey: ["ticket-qr", pnr],
    queryFn: () => getTicketQr(pnr),
    enabled: ticket.isSuccess,
  });
  const qrUrl = useObjectUrl(qr.data);

  async function downloadPdf() {
    setDownloadError(null);
    try {
      const url = URL.createObjectURL(await getTicketPdf(pnr));
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${pnr}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(errorMessage(error));
    }
  }

  return (
    <main className="page narrow">
      <h1>E-ticket</h1>
      {ticket.isLoading && <p role="status">Loading ticket…</p>}
      {ticket.error && (
        <p className="error" role="alert">
          {errorMessage(ticket.error)} <Link to={`/reservations/${pnr}/pay`}>Pay for this PNR</Link>
        </p>
      )}

      {ticket.data && (
        <section className="card ticket">
          <dl className="summary">
            <div><dt>PNR</dt><dd>{ticket.data.pnr}</dd></div>
            <div><dt>Ticket no.</dt><dd>{ticket.data.ticket_number}</dd></div>
            <div><dt>Fare paid</dt><dd>{formatInr(ticket.data.amount)}</dd></div>
            <div><dt>Issued</dt><dd>{formatDateTime(ticket.data.issued_at)}</dd></div>
          </dl>
          <div className="qr">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR code for PNR ${ticket.data.pnr}`} width={160} height={160} />
            ) : (
              <span className="muted">Loading QR…</span>
            )}
          </div>
          <button className="primary" onClick={downloadPdf}>Download PDF</button>
          {downloadError && <p className="error" role="alert">{downloadError}</p>}
        </section>
      )}
    </main>
  );
}
