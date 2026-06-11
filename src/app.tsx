import { Routes, Route, Navigate } from "react-router";
import HomePage from "./pages/home";
import PlansPage from "./pages/plans";
import WizardPage from "./pages/wizard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/wizard" element={<WizardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
