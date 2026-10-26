
import { useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
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
  const [open, setOpen] = useState(false);
  const isStaff = session?.role === "staff" || session?.role === "admin";

  function signOut() {
    clearToken();
    setOpen(false);
    navigate("/accounts");
  }

  return (
    <nav aria-label="Main" className={open ? "open" : undefined}>
      <button
        type="button"
        className="menu-toggle"
        aria-label="Menu"
        aria-expanded={open}
        aria-controls="main-links"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="menu-toggle-bars" aria-hidden="true"><span /><span /></span>
        <span className="menu-toggle-label">Menu</span>
      </button>
      {/* Any link click also closes the menu on narrow screens. */}
      <div id="main-links" className="nav-links" onClick={() => setOpen(false)}>
        <NavLink to="/" end>Search trains</NavLink>
        <NavLink to="/pnr-status">PNR status</NavLink>
        {session && <NavLink to="/my-journeys">My journeys</NavLink>}
        {session && <NavLink to="/wallet">Wallet</NavLink>}
        {session && <NavLink to="/refunds">Refunds</NavLink>}
        {isStaff && <NavLink to="/operations">{session?.role === "admin" ? "Operations & analytics" : "Operations"}</NavLink>}
        {session && <NavLink to="/accounts">Account</NavLink>}
      </div>
      {session ? (
        <button type="button" className="secondary nav-cta" onClick={signOut}>
          Sign out
        </button>
      ) : (
        <Link to="/accounts" className="primary nav-cta" onClick={() => setOpen(false)}>
          Sign in
        </Link>
      )}
    </nav>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <p className="footer-wordmark">RailYatri.</p>
          <p className="footer-tagline">Search, book and travel. Railway reservations without the queue.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h2>Travel</h2>
            <ul>
              <li><Link to="/">Search trains</Link></li>
              <li><Link to="/pnr-status">PNR status</Link></li>
              <li><Link to="/my-journeys">My journeys</Link></li>
            </ul>
          </div>
          <div>
            <h2>Money</h2>
            <ul>
              <li><Link to="/wallet">Wallet</Link></li>
              <li><Link to="/refunds">Refunds</Link></li>
              <li><Link to="/accounts">Account</Link></li>
            </ul>
          </div>
        </div>
      </div>
      <p className="footer-base">RailYatri · Railway reservation and management system</p>
    </footer>
  );
}

export function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="RailYatri home">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span className="brand-word">RailYatri</span>
        </Link>
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
          element={
            <main className="page hero">
              <h1>Page not found.</h1>
              <p className="lede">That stop isn’t on this line.</p>
              <Link to="/" className="primary">Search trains</Link>
            </main>
          }
        />
      </Routes>

      <SiteFooter />
    </>
  );
}
