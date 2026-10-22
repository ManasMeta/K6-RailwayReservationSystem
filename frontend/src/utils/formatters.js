/**
 * Formatting and helper utilities for NRRMS G5 Wallet
 */

/**
 * Format a number or string amount as Indian Rupee currency (₹)
 * @param {number|string|Decimal} amount 
 * @param {string} currency 
 * @returns {string} e.g. "₹ 1,250.00"
 */
export function formatCurrency(amount, currency = 'INR') {
  if (amount === undefined || amount === null || amount === '') return '₹ 0.00';
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(numeric)) return '₹ 0.00';

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);

  return `₹ ${formatted}`;
}

/**
 * Format ISO datetime string to user-friendly Indian standard readable date
 * @param {string|Date} dateStr 
 * @returns {string} e.g. "22 Oct 2026, 11:45 AM"
 */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Format ISO date string into relative or short date
 * @param {string|Date} dateStr 
 * @returns {string} e.g. "22 Oct 2026"
 */
export function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateStr);
  }
}

/**
 * Generate a cryptographically secure Idempotency-Key
 * Min 8, max 128 chars required by backend.
 * Uses prefix 'g5-' followed by UUID or random hex.
 * @returns {string} e.g. "g5-7b5c898c-ec89-4bc6-8d6f-2bce5642a49f"
 */
export function generateIdempotencyKey(prefix = 'g5') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/**
 * Validate PNR string against backend pattern ^[A-Za-z0-9]{1,20}$
 * @param {string} pnr 
 * @returns {boolean}
 */
export function isValidPNR(pnr) {
  if (!pnr || typeof pnr !== 'string') return false;
  return /^[A-Za-z0-9]{1,20}$/.test(pnr.trim());
}

/**
 * Copy text to clipboard and invoke optional callback
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
