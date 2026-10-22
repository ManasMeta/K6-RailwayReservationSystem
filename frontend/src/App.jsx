import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import MainLayout from './layouts/MainLayout';
import WalletDashboard from './pages/WalletDashboard';
import TopupPage from './pages/TopupPage';
import PaymentPage from './pages/PaymentPage';
import TicketDetailsPage from './pages/TicketDetailsPage';
import RefundsPage from './pages/RefundsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<WalletDashboard />} />
            <Route path="topup" element={<TopupPage />} />
            <Route path="pay" element={<PaymentPage />} />
            <Route path="tickets" element={<TicketDetailsPage />} />
            <Route path="tickets/:pnr" element={<TicketDetailsPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
