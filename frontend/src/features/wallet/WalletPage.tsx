import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { errorMessage } from "../../api/client";
import { getStatement, getWallet, topUp } from "./api";
import { formatDateTime, formatInr, isValidAmount, newIdempotencyKey } from "./format";

const PAGE_SIZE = 10;
const PRESETS = ["100", "500", "1000", "2000"];

export function WalletPage() {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("500");
  const [offset, setOffset] = useState(0);
  // One key per top-up attempt: a retry after a network error reuses it.
  const keyRef = useRef(newIdempotencyKey());

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const statement = useQuery({
    queryKey: ["statement", offset],
    queryFn: () => getStatement(PAGE_SIZE, offset),
  });

  const topup = useMutation({
    mutationFn: () => topUp(amount, keyRef.current),
    onSuccess: () => {
      keyRef.current = newIdempotencyKey();
      setOffset(0);
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      void queryClient.invalidateQueries({ queryKey: ["statement"] });
    },
  });

  const valid = isValidAmount(amount);
  const page = statement.data;

  return (
    <main className="page">
      <h1>Wallet</h1>
      <p className="lede">Pay for tickets from your wallet. Refunds come back here.</p>

      <section className="wallet-top">
        <div className="card balance" aria-label="Wallet balance">
          <span className="muted">Balance</span>
          <strong className="balance-amount">
            {wallet.data ? formatInr(wallet.data.balance) : "…"}
          </strong>
          {wallet.error && <p className="error" role="alert">{errorMessage(wallet.error)}</p>}
        </div>

        <form
          className="card topup"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) topup.mutate();
          }}
        >
          <h2>Add money</h2>
          <p className="muted">Simulated UPI: no real money moves.</p>
          <div className="presets" role="group" aria-label="Quick amounts">
            {PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                aria-pressed={amount === preset}
                onClick={() => setAmount(preset)}
              >
                {formatInr(preset).replace(".00", "")}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="topup-amount">Amount (₹)</label>
            <input
              id="topup-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.trim())}
              aria-invalid={!valid}
              aria-describedby="topup-hint"
            />
            <span id="topup-hint" className={valid ? "hint" : "hint error"}>
              {valid ? "Up to 2 decimals." : "Enter an amount above 0, up to 2 decimals."}
            </span>
          </div>
          <button type="submit" className="primary" disabled={!valid || topup.isPending}>
            {topup.isPending ? "Adding…" : "Add money"}
          </button>
          {topup.isSuccess && (
            <p role="status" className="success">
              Added {formatInr(topup.data.amount)}. New balance {formatInr(topup.data.balance)}.
            </p>
          )}
          {topup.error && <p className="error" role="alert">{errorMessage(topup.error)}</p>}
        </form>
      </section>

      <h2>Statement</h2>
      {statement.error && <p className="error" role="alert">{errorMessage(statement.error)}</p>}
      {page && page.items.length === 0 && <p className="empty">No transactions yet.</p>}
      {page && page.items.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Wallet statement</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Details</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col" className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((item) => (
                  <tr key={item.ledger_txn_id}>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>
                      {item.description}
                      <span className="muted"> · {item.type.toLowerCase()}</span>
                    </td>
                    <td className={`num ${item.direction === "CREDIT" ? "credit" : "debit"}`}>
                      {item.direction === "CREDIT" ? "+" : "−"}
                      {formatInr(item.amount)}
                    </td>
                    <td className="num">{formatInr(item.balance_after)}</td>
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
              {offset + 1}–{offset + page.items.length} of {page.total}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= page.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Older
            </button>
          </div>
        </>
      )}
    </main>
  );
}
