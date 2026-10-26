
import { Link, Route, Routes } from "react-router-dom";
import { JourneySearchPage } from "./features/network/JourneySearchPage";
import { TimetablePage } from "./features/network/TimetablePage";
import { OperationsPage } from "./features/operations/OperationsPage";
import { PNRStatusPage } from "./features/operations/PNRStatusPage";
import { PayReservationPage } from "./features/wallet/PayReservationPage";
import { RefundsPage } from "./features/wallet/RefundsPage";
import { TicketPage } from "./features/wallet/TicketPage";
import { WalletPage } from "./features/wallet/WalletPage";
import AccountsPage from "./features/accounts/AccountsPage";
import { RequireAuth } from "./features/accounts/RequireAuth";
import { BookingPage, MyJourneysPage } from "./features/reservations/ReservationPages";

export function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Yatrio</Link>
        <nav aria-label="Main">
          <Link to="/">Search trains</Link>
          <Link to="/my-journeys">My journeys</Link>
          <Link to="/wallet">Wallet</Link>
          <Link to="/refunds">Refunds</Link>
          <Link to="/operations">Operations</Link>
          <Link to="/pnr-status">PNR Status</Link>
          <Link to="/accounts">Accounts</Link>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<JourneySearchPage />} />
        <Route path="/trains/:trainNo" element={<TimetablePage />} />
        <Route path="/operations" element={<OperationsPage />} />
        <Route path="/pnr-status" element={<PNRStatusPage />} />
        <Route path="/book" element={<RequireAuth><BookingPage /></RequireAuth>} />
        <Route path="/my-journeys" element={<RequireAuth><MyJourneysPage /></RequireAuth>} />
        <Route path="/wallet" element={<RequireAuth><WalletPage /></RequireAuth>} />
        <Route path="/reservations/:pnr/pay" element={<RequireAuth><PayReservationPage /></RequireAuth>} />
        <Route path="/tickets/:pnr" element={<RequireAuth><TicketPage /></RequireAuth>} />
        <Route path="/refunds" element={<RequireAuth><RefundsPage /></RequireAuth>} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route
          path="*"
          element={<main className="page"><h1>Page not found</h1></main>}
        />
      </Routes>
    </>
  );
}
