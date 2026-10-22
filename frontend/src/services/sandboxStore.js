/**
 * In-browser sandbox simulation for NRRMS G5 Wallet & Ticketing.
 * Exactly implements the SQL business rules from migrations 0501-0516.
 * Used when Sandbox Mode is activated or as a fallback when backend is unreachable.
 */

const STORAGE_KEY = 'nrrms_sandbox_data_v1';

function getInitialState() {
  return {
    wallet: {
      wallet_id: 101,
      user_id: 1,
      balance: 2450.00,
      currency: 'INR',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    topups: [
      {
        topup_id: 1001,
        wallet_id: 101,
        amount: 2000.00,
        status: 'COMPLETED',
        provider_reference: 'MOCK-UPI-SANDBOX-001',
        idempotency_key: 'g5-init-seed-topup-01',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        topup_id: 1002,
        wallet_id: 101,
        amount: 1500.00,
        status: 'COMPLETED',
        provider_reference: 'MOCK-UPI-SANDBOX-002',
        idempotency_key: 'g5-init-seed-topup-02',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ],
    reservations: [
      {
        pnr: 'PNR8941203',
        total_fare: 450.00,
        status: 'PENDING_PAYMENT',
        departure_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        train_name: 'Vande Bharat Express (22436)',
        from_station: 'NDLS - New Delhi',
        to_station: 'BSB - Varanasi Jn',
      },
      {
        pnr: 'PNR1029384',
        total_fare: 1050.00,
        status: 'PENDING_PAYMENT',
        departure_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        train_name: 'Rajdhani Express (12952)',
        from_station: 'MMCT - Mumbai Central',
        to_station: 'NDLS - New Delhi',
      },
      {
        pnr: 'PNR7765219',
        total_fare: 3200.00,
        status: 'PENDING_PAYMENT',
        departure_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        train_name: 'Tejas Superfast (20982)',
        from_station: 'SBC - KSR Bengaluru',
        to_station: 'MAS - MGR Chennai',
      },
      {
        pnr: 'PNR4490128',
        total_fare: 820.00,
        status: 'CONFIRMED',
        departure_at: new Date(Date.now() + 120 * 60 * 60 * 1000).toISOString(),
        train_name: 'Shatabdi Express (12002)',
        from_station: 'NDLS - New Delhi',
        to_station: 'BPL - Bhopal Jn',
      }
    ],
    payments: [
      {
        payment_id: 501,
        wallet_id: 101,
        pnr: 'PNR4490128',
        amount: 820.00,
        ticket_number: 'ET-2026-PNR4490128',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        idempotency_key: 'g5-seed-pay-4490128',
      }
    ],
    tickets: {
      'PNR4490128': {
        pnr: 'PNR4490128',
        ticket_number: 'ET-2026-PNR4490128',
        amount: 820.00,
        issued_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        qr_payload: 'NRRMS:PNR4490128:ET-2026-PNR4490128:USER1:INR820.00',
      }
    },
    refunds: [
      {
        refund_id: 301,
        wallet_id: 101,
        pnr: 'PNR3309182',
        amount: 450.00,
        reason: 'Passenger voluntary cancellation (>48h before departure - 90% refund)',
        status: 'COMPLETED',
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        refund_id: 302,
        wallet_id: 101,
        pnr: 'PNR5521904',
        amount: 620.00,
        reason: 'Railway operational cancellation (100% full refund)',
        status: 'COMPLETED',
        created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ],
    transactions: [
      {
        ledger_txn_id: 104,
        type: 'PAYMENT',
        reference_type: 'RESERVATION',
        reference_id: 'PNR4490128',
        status: 'POSTED',
        description: 'Payment for reservation PNR4490128',
        amount: 820.00,
        direction: 'DEBIT',
        balance_after: 2450.00,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        ledger_txn_id: 103,
        type: 'REFUND',
        reference_type: 'CANCELLATION',
        reference_id: 'REF301',
        status: 'POSTED',
        description: 'Refund for cancelled reservation PNR3309182',
        amount: 450.00,
        direction: 'CREDIT',
        balance_after: 3270.00,
        created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        ledger_txn_id: 102,
        type: 'TOPUP',
        reference_type: 'TOPUP',
        reference_id: '1002',
        status: 'POSTED',
        description: 'Simulated UPI wallet top-up',
        amount: 1500.00,
        direction: 'CREDIT',
        balance_after: 2820.00,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        ledger_txn_id: 101,
        type: 'TOPUP',
        reference_type: 'TOPUP',
        reference_id: '1001',
        status: 'POSTED',
        description: 'Simulated UPI wallet top-up',
        amount: 2000.00,
        direction: 'CREDIT',
        balance_after: 2000.00,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      }
    ]
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading sandbox storage:', e);
  }
  const init = getInitialState();
  saveStore(init);
  return init;
}

function saveStore(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed saving sandbox storage:', e);
  }
}

export const sandboxStore = {
  reset() {
    const init = getInitialState();
    saveStore(init);
    return init;
  },

  getWallet() {
    const data = loadStore();
    return data.wallet;
  },

  createTopup(amount, idempotencyKey) {
    const data = loadStore();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    // Check idempotency conflict
    const existing = data.topups.find(t => t.idempotency_key === idempotencyKey);
    if (existing) {
      if (Math.abs(existing.amount - numAmount) > 0.001) {
        const err = new Error('Idempotency key was already used with different request details');
        err.code = 'IDEMPOTENCY_CONFLICT';
        err.status = 409;
        throw err;
      }
      return {
        topup_id: existing.topup_id,
        wallet_id: data.wallet.wallet_id,
        amount: existing.amount,
        status: existing.status,
        provider_reference: existing.provider_reference,
        balance: data.wallet.balance,
        currency: data.wallet.currency,
        simulated: true,
        replayed: true,
      };
    }

    const newBalance = Math.round((data.wallet.balance + numAmount) * 100) / 100;
    const topupId = 1000 + data.topups.length + 1;
    const providerRef = `MOCK-UPI-${idempotencyKey.replace(/[^A-Za-z0-9]/g, '').slice(0, 16).toUpperCase()}`;

    const topupRecord = {
      topup_id: topupId,
      wallet_id: data.wallet.wallet_id,
      amount: numAmount,
      status: 'COMPLETED',
      provider_reference: providerRef,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
    };

    data.topups.push(topupRecord);
    data.wallet.balance = newBalance;
    data.wallet.updated_at = new Date().toISOString();

    const txnId = 100 + data.transactions.length + 1;
    data.transactions.unshift({
      ledger_txn_id: txnId,
      type: 'TOPUP',
      reference_type: 'TOPUP',
      reference_id: String(topupId),
      status: 'POSTED',
      description: 'Simulated UPI wallet top-up',
      amount: numAmount,
      direction: 'CREDIT',
      balance_after: newBalance,
      created_at: new Date().toISOString(),
    });

    saveStore(data);

    return {
      topup_id: topupId,
      wallet_id: data.wallet.wallet_id,
      amount: numAmount,
      status: 'COMPLETED',
      provider_reference: providerRef,
      balance: newBalance,
      currency: data.wallet.currency,
      simulated: true,
      replayed: false,
    };
  },

  getTransactions(limit = 20, offset = 0) {
    const data = loadStore();
    const sorted = [...data.transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const items = sorted.slice(offset, offset + limit);
    return {
      items,
      limit,
      offset,
      total: sorted.length,
    };
  },

  getPaymentQuote(pnr) {
    const data = loadStore();
    const cleanedPnr = pnr.trim().toUpperCase();
    const res = data.reservations.find(r => r.pnr.toUpperCase() === cleanedPnr);
    if (!res) {
      const err = new Error(`Reservation ${pnr} was not found`);
      err.code = 'RESERVATION_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    return {
      pnr: res.pnr,
      amount: res.total_fare,
      status: res.status,
      balance: data.wallet.balance,
      payable: res.status === 'PENDING_PAYMENT',
      train_name: res.train_name,
      from_station: res.from_station,
      to_station: res.to_station,
      departure_at: res.departure_at,
    };
  },

  payReservation(pnr, idempotencyKey) {
    const data = loadStore();
    const cleanedPnr = pnr.trim().toUpperCase();

    // Check if already paid with same idempotency key (replay)
    const existingPayment = data.payments.find(p => p.pnr.toUpperCase() === cleanedPnr);
    if (existingPayment) {
      return {
        payment_id: existingPayment.payment_id,
        pnr: existingPayment.pnr,
        amount: existingPayment.amount,
        balance: data.wallet.balance,
        ticket_number: existingPayment.ticket_number,
        replayed: true,
      };
    }

    const res = data.reservations.find(r => r.pnr.toUpperCase() === cleanedPnr);
    if (!res) {
      const err = new Error(`Reservation ${pnr} was not found`);
      err.code = 'RESERVATION_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (res.status !== 'PENDING_PAYMENT') {
      const err = new Error(`Reservation ${pnr} is ${res.status} and cannot be paid`);
      err.code = 'RESERVATION_NOT_PAYABLE';
      err.status = 409;
      throw err;
    }

    if (data.wallet.balance < res.total_fare) {
      const diff = (res.total_fare - data.wallet.balance).toFixed(2);
      const err = new Error(`Insufficient wallet balance. You need ₹ ${diff} more to pay this fare.`);
      err.code = 'INSUFFICIENT_FUNDS';
      err.status = 402;
      throw err;
    }

    // Deduct
    const newBalance = Math.round((data.wallet.balance - res.total_fare) * 100) / 100;
    data.wallet.balance = newBalance;
    data.wallet.updated_at = new Date().toISOString();
    res.status = 'CONFIRMED';

    const paymentId = 500 + data.payments.length + 1;
    const ticketNumber = `ET-2026-${res.pnr}`;

    data.payments.push({
      payment_id: paymentId,
      wallet_id: data.wallet.wallet_id,
      pnr: res.pnr,
      amount: res.total_fare,
      ticket_number: ticketNumber,
      created_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
    });

    data.tickets[res.pnr] = {
      pnr: res.pnr,
      ticket_number: ticketNumber,
      amount: res.total_fare,
      issued_at: new Date().toISOString(),
      qr_payload: `NRRMS:${res.pnr}:${ticketNumber}:USER1:INR${res.total_fare}`,
      train_name: res.train_name,
      from_station: res.from_station,
      to_station: res.to_station,
      departure_at: res.departure_at,
    };

    const txnId = 100 + data.transactions.length + 1;
    data.transactions.unshift({
      ledger_txn_id: txnId,
      type: 'PAYMENT',
      reference_type: 'RESERVATION',
      reference_id: res.pnr,
      status: 'POSTED',
      description: `Payment for reservation ${res.pnr}`,
      amount: res.total_fare,
      direction: 'DEBIT',
      balance_after: newBalance,
      created_at: new Date().toISOString(),
    });

    saveStore(data);

    return {
      payment_id: paymentId,
      pnr: res.pnr,
      amount: res.total_fare,
      balance: newBalance,
      ticket_number: ticketNumber,
      replayed: false,
    };
  },

  getRefunds(limit = 20, offset = 0) {
    const data = loadStore();
    const sorted = [...data.refunds].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const items = sorted.slice(offset, offset + limit);
    return {
      items,
      limit,
      offset,
      total: sorted.length,
    };
  },

  getTicket(pnr) {
    const data = loadStore();
    const cleanedPnr = pnr.trim().toUpperCase();
    const ticket = data.tickets[cleanedPnr];
    if (!ticket) {
      const err = new Error(`No e-ticket found for PNR ${pnr}`);
      err.code = 'TICKET_NOT_FOUND';
      err.status = 404;
      throw err;
    }
    return ticket;
  },

  getSampleReservations() {
    const data = loadStore();
    return data.reservations;
  }
};

export default sandboxStore;
