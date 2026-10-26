import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BookingFlow } from "./components/BookingFlow";
import { MyJourneys } from "./components/MyJourneys";
import "./reservations.css";

/** /book?train=&name=&from=&to=&date= : reached from a journey search result. */
export function BookingPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const train = params.get("train");
  const from = params.get("from");
  const to = params.get("to");
  const date = params.get("date");

  if (!train || !from || !to || !date) return <Navigate to="/" replace />;

  return (
    <div className="reservations-ui">
      <BookingFlow
        initialTrainNo={train}
        initialTrainName={params.get("name") ?? train}
        initialFromStation={from}
        initialToStation={to}
        initialRunDate={date}
        onPayClick={(pnr) => navigate(`/reservations/${pnr}/pay`)}
      />
    </div>
  );
}

export function MyJourneysPage() {
  const navigate = useNavigate();
  return (
    <div className="reservations-ui">
      <MyJourneys
        onNewBookingClick={() => navigate("/")}
        onPayClick={(pnr) => navigate(`/reservations/${pnr}/pay`)}
      />
    </div>
  );
}
