import { apiClient } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const walletService = {
  /**
   * Check backend health status
   */
  async checkHealth() {
    try {
      const res = await apiClient.get('/health', { timeout: 3000 });
      return { online: true, data: res.data };
    } catch (err) {
      return { online: false, error: err.message };
    }
  },

  /**
   * Check database connectivity
   */
  async checkDatabaseHealth() {
    try {
      const res = await apiClient.get('/health/database', { timeout: 3000 });
      return { connected: true, data: res.data };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  },

  /**
   * Fetch current user's wallet balance and metadata
   * GET /api/v1/wallet
   */
  async getWallet() {
    const res = await apiClient.get('/api/v1/wallet');
    return res.data;
  },

  /**
   * Simulated UPI wallet top-up
   * POST /api/v1/wallet/topups
   * @param {number|string} amount 
   * @param {string} idempotencyKey 
   */
  async createTopup(amount, idempotencyKey) {
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await apiClient.post(
      '/api/v1/wallet/topups',
      {
        amount: numericAmount,
        idempotency_key: idempotencyKey,
      },
      { headers }
    );
    return res.data;
  },

  /**
   * Fetch paginated wallet statement (ledger transactions)
   * GET /api/v1/wallet/transactions?limit=20&offset=0
   */
  async getTransactions(limit = 20, offset = 0) {
    const res = await apiClient.get('/api/v1/wallet/transactions', {
      params: { limit, offset },
    });
    return res.data;
  },

  /**
   * Fetch payment quote for a reservation PNR
   * GET /api/v1/reservations/{pnr}/payment
   * @param {string} pnr 
   */
  async getPaymentQuote(pnr) {
    const res = await apiClient.get(`/api/v1/reservations/${encodeURIComponent(pnr)}/payment`);
    return res.data;
  },

  /**
   * Pay a reservation from wallet balance
   * POST /api/v1/reservations/{pnr}/pay
   * @param {string} pnr 
   * @param {string} idempotencyKey 
   */
  async payReservation(pnr, idempotencyKey) {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const res = await apiClient.post(
      `/api/v1/reservations/${encodeURIComponent(pnr)}/pay`,
      {},
      { headers }
    );
    return res.data;
  },

  /**
   * Fetch paginated refund history
   * GET /api/v1/refunds?limit=20&offset=0
   */
  async getRefunds(limit = 20, offset = 0) {
    const res = await apiClient.get('/api/v1/refunds', {
      params: { limit, offset },
    });
    return res.data;
  },

  /**
   * Fetch e-ticket details for a paid reservation
   * GET /api/v1/tickets/{pnr}
   * @param {string} pnr 
   */
  async getTicket(pnr) {
    const res = await apiClient.get(`/api/v1/tickets/${encodeURIComponent(pnr)}`);
    return res.data;
  },

  /**
   * Download ticket PDF as a blob
   * GET /api/v1/tickets/{pnr}.pdf
   * @param {string} pnr 
   */
  async downloadTicketPdf(pnr) {
    const res = await apiClient.get(`/api/v1/tickets/${encodeURIComponent(pnr)}.pdf`, {
      responseType: 'blob',
    });
    return res.data;
  },

  /**
   * Get direct URL for ticket QR image
   * GET /api/v1/tickets/{pnr}/qr.png
   */
  getTicketQrUrl(pnr) {
    return `${API_BASE_URL}/api/v1/tickets/${encodeURIComponent(pnr)}/qr.png`;
  },

  /**
   * Get direct URL for ticket PDF download
   */
  getTicketPdfUrl(pnr) {
    return `${API_BASE_URL}/api/v1/tickets/${encodeURIComponent(pnr)}.pdf`;
  },
};

export default walletService;
