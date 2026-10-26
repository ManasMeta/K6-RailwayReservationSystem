
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { clearToken } from "./api/client";
import { JourneySearchPage } from "./features/network/JourneySearchPage";
import { TimetablePage } from "./features/network/TimetablePage";
import { OperationsPage } from "./features/operations/OperationsPage";
import { PNRStatusPage } from "./features/operations/PNRStatusPage";
import { PayReservationPage } from "./features/wallet/PayReservationPage";
import { RefundsPage } from "./features/wallet/RefundsPage";
import { TicketPage } from "./features/wallet/TicketPage";
import { WalletPage } from "./features/wallet/WalletPage";
import AccountsPage from "./features/accounts/AccountsPage";
import { RequireAuth, RequireRole } from "./features/accounts/RequireAuth";
import { useSession } from "./features/accounts/session";
import { BookingPage, MyJourneysPage } from "./features/reservations/ReservationPages";

function MainNav() {
  const session = useSession();
  const navigate = useNavigate();
  const isStaff = session?.role === "staff" || session?.role === "admin";

  function signOut() {
    clearToken();
    navigate("/accounts");
  }

  return (
    <nav aria-label="Main">
      <Link to="/">Search trains</Link>
      <Link to="/pnr-status">PNR status</Link>
      {session && <Link to="/my-journeys">My journeys</Link>}
      {session && <Link to="/wallet">Wallet</Link>}
      {session && <Link to="/refunds">Refunds</Link>}
      {isStaff && <Link to="/operations">{session?.role === "admin" ? "Operations & analytics" : "Operations"}</Link>}
      <Link to="/accounts">{session ? "Account" : "Sign in"}</Link>
      {session && (
        <button type="button" className="link-button" onClick={signOut}>
          Sign out
        </button>
      )}
    </nav>
  );
}

export function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Yatrio</Link>
        <MainNav />
      </header>

      <Routes>
        <Route path="/" element={<JourneySearchPage />} />
        <Route path="/trains/:trainNo" element={<TimetablePage />} />
        <Route path="/operations" element={<RequireRole roles={["staff", "admin"]}><OperationsPage /></RequireRole>} />
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
