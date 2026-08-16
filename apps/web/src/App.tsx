import { Navigate, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { PortfolioPage } from "./pages/PortfolioPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { CashFlowPage } from "./pages/CashFlowPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TradesPage } from "./pages/TradesPage";
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { Loading } from "./components/ui";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="…" />;
  if (!user) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="trades/*" element={<Navigate to="/sessions" replace />} />
        <Route path="sessions" element={<TradesPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
