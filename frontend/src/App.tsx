import { Link, Route, Routes } from "react-router-dom";
import { JourneySearchPage } from "./features/network/JourneySearchPage";
import { TimetablePage } from "./features/network/TimetablePage";

// Each group adds its own routes here via PR; G1 owns the role-aware layout.
export function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">NRRMS</Link>
        <nav aria-label="Main">
          <Link to="/">Search trains</Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<JourneySearchPage />} />
        <Route path="/trains/:trainNo" element={<TimetablePage />} />
        <Route path="*" element={<main className="page"><h1>Page not found</h1></main>} />
      </Routes>
    </>
  );
}
