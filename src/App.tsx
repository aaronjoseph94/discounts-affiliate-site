/** Public homepage plus a password-gated /admin form. */
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Admin } from "./pages/Admin.tsx";
import { Home } from "./pages/Home.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
