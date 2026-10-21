import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { errorCode, getQuote, payReservation } from "./api";
import { formatInr, newIdempotencyKey } from "./format";

export function PayReservationPage() {
  const { pnr = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Same key for retries of this payment; the server returns the first result.
  const keyRef = useRef(newIdempotencyKey());

  const quote = useQuery({ queryKey: ["quote", pnr], queryFn: () => getQuote(pnr), enabled: pnr !== "" });

  const pay = useMutation({
    mutationFn: () => payReservation(pnr, keyRef.current),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["statement"] });
      navigate(`/tickets/${pnr}`);
    },
  });

  const data = quote.data;
  const short = data ? Number(data.balance) < Number(data.amount) : false;
  const insufficient = errorCode(pay.error) === "INSUFFICIENT_FUNDS" || short;

  return (
    <main className="page narrow">
      <h1>Pay for PNR {pnr}</h1>
      {quote.isLoading && <p role="status">Loading…</p>}
      {quote.error && <p className="error" role="alert">{errorMessage(quote.error)}</p>}

      {data && (
        <section className="card">
          <dl className="summary">
            <div><dt>Fare</dt><dd>{formatInr(data.amount)}</dd></div>
            <div><dt>Wallet balance</dt><dd>{formatInr(data.balance)}</dd></div>
            {!short && data.payable && (
              <div>
                <dt>Balance after payment</dt>
                <dd>{formatInr((Number(data.balance) - Number(data.amount)).toFixed(2))}</dd>
              </div>
            )}
          </dl>

          {!data.payable && (
            <p role="status">
              This reservation is {data.status.toLowerCase().replace("_", " ")} and cannot be paid.{" "}
              <Link to={`/tickets/${pnr}`}>View e-ticket</Link>
            </p>
          )}
          {insufficient && data.payable && (
            <p className="error" role="alert">
              Your wallet balance is too low. <Link to="/wallet">Add money</Link> and come back.
            </p>
          )}
          {pay.error && errorCode(pay.error) !== "INSUFFICIENT_FUNDS" && (
            <p className="error" role="alert">{errorMessage(pay.error)}</p>
          )}

          <button
            className="primary"
            disabled={!data.payable || short || pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? "Paying…" : `Pay ${formatInr(data.amount)} from wallet`}
          </button>
        </section>
      )}
    </main>
  );
}
