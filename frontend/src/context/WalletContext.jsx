import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import walletService from '../services/walletService';
import sandboxStore from '../services/sandboxStore';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [userId, setUserIdState] = useState(() => {
    return localStorage.getItem('nrrms_user_id') || import.meta.env.VITE_DEFAULT_USER_ID || '1';
  });

  const [isSandbox, setIsSandbox] = useState(() => {
    const saved = localStorage.getItem('nrrms_is_sandbox');
    return saved !== null ? saved === 'true' : false;
  });

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  
  const [backendHealth, setBackendHealth] = useState({
    checked: false,
    online: false,
    database: false,
    apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  });

  const showToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, ...toast }]);
    if (toast.duration !== false) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toast.duration || 4500);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setUserId = useCallback((newId) => {
    localStorage.setItem('nrrms_user_id', newId);
    setUserIdState(newId);
    showToast({
      type: 'info',
      title: 'Active User Switched',
      message: `Now acting as User ID #${newId}`,
    });
  }, [showToast]);

  const toggleSandbox = useCallback((val) => {
    const nextVal = typeof val === 'boolean' ? val : !isSandbox;
    setIsSandbox(nextVal);
    localStorage.setItem('nrrms_is_sandbox', String(nextVal));
    showToast({
      type: nextVal ? 'warning' : 'success',
      title: nextVal ? 'Sandbox Mode Active' : 'Live Backend Mode Active',
      message: nextVal
        ? 'Using local in-memory simulation store. Changes will not touch PostgreSQL.'
        : `Connecting directly to FastAPI at ${backendHealth.apiUrl}`,
    });
  }, [isSandbox, backendHealth.apiUrl, showToast]);

  // Check backend health
  const checkBackend = useCallback(async () => {
    try {
      const res = await walletService.checkHealth();
      let dbConnected = false;
      if (res.online) {
        const dbRes = await walletService.checkDatabaseHealth();
        dbConnected = dbRes.connected;
      }
      setBackendHealth({
        checked: true,
        online: res.online,
        database: dbConnected,
        apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
      });
      return { online: res.online, database: dbConnected };
    } catch {
      setBackendHealth({
        checked: true,
        online: false,
        database: false,
        apiUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
      });
      return { online: false, database: false };
    }
  }, []);

  // Fetch or refresh wallet
  const refreshWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSandbox) {
        const data = sandboxStore.getWallet();
        setWallet(data);
      } else {
        const data = await walletService.getWallet();
        setWallet(data);
      }
    } catch (err) {
      console.warn('Failed to load live wallet:', err);
      setError(err.message || 'Failed to load wallet');
      // If live backend call fails and user hasn't explicitly set isSandbox, show recommendation
      if (!isSandbox) {
        showToast({
          type: 'error',
          title: 'Backend Connection Failed',
          message: `${err.message}. You can enable Sandbox Mode in the header to explore the app.`,
          duration: 7000,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isSandbox, showToast]);

  // Initialize
  useEffect(() => {
    checkBackend().then(({ online }) => {
      // If backend is offline on initial load and sandbox wasn't explicitly saved false, enable sandbox
      const savedSandbox = localStorage.getItem('nrrms_is_sandbox');
      if (!online && savedSandbox === null) {
        setIsSandbox(true);
      }
    });
  }, [checkBackend]);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet, userId, isSandbox]);

  const value = {
    userId,
    setUserId,
    isSandbox,
    toggleSandbox,
    wallet,
    loading,
    error,
    refreshWallet,
    backendHealth,
    checkBackend,
    toasts,
    showToast,
    removeToast,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

export default WalletContext;
