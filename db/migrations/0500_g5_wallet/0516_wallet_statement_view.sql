-- Author: G5 database
-- Every posted money movement of a wallet with its running balance:
-- SUM(signed_amount) OVER (PARTITION BY wallet_id ORDER BY posted_at, ledger_txn_id).
-- Top-ups and refunds credit (+), payments debit (-).
CREATE OR REPLACE VIEW v_wallet_statement AS
SELECT m.wallet_id,
       m.ledger_txn_id,
       m.kind,
       m.reference_id,
       m.description,
       m.signed_amount,
       m.posted_at,
       SUM(m.signed_amount) OVER (
           PARTITION BY m.wallet_id
           ORDER BY m.posted_at, m.ledger_txn_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS balance_after
FROM (
    SELECT tp.wallet_id, lt.ledger_txn_id, 'TOPUP'::TEXT AS kind,
           tp.topup_id::TEXT AS reference_id, lt.description,
           tp.amount AS signed_amount, lt.created_at AS posted_at
      FROM topups tp
      JOIN ledger_txns lt ON lt.ledger_txn_id = tp.ledger_txn_id
     WHERE lt.status = 'POSTED'
    UNION ALL
    SELECT p.wallet_id, lt.ledger_txn_id, 'PAYMENT',
           p.pnr, lt.description, -p.amount, lt.created_at
      FROM payments p
      JOIN ledger_txns lt ON lt.ledger_txn_id = p.ledger_txn_id
     WHERE lt.status = 'POSTED'
    UNION ALL
    SELECT r.wallet_id, lt.ledger_txn_id, 'REFUND',
           r.pnr, lt.description, r.amount, lt.created_at
      FROM refunds r
      JOIN ledger_txns lt ON lt.ledger_txn_id = r.ledger_txn_id
     WHERE lt.status = 'POSTED' AND r.status = 'COMPLETED'
) m;
