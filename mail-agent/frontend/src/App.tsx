import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./pages/DashboardPage";
import MailsPage from "./pages/MailsPage";
import SessionPage from "./pages/SessionPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/mails" element={<MailsPage />} />
          <Route path="/session" element={<SessionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
