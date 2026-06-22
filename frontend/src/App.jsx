import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ConsentGate from './components/auth/ConsentGate';
import Login from './pages/auth/Login';
import Activate from './pages/auth/Activate';
import ResetPassword from './pages/auth/ResetPassword';
import ForgotPassword from './pages/auth/ForgotPassword';
import AdminDashboard from './pages/admin/Dashboard';
import PacienteDetalle from './pages/admin/Paciente';
import Calendario from './pages/admin/Calendario';
import Seguridad from './pages/admin/Seguridad';
import PacienteDashboard from './pages/paciente/Dashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<Activate />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/paciente/:id" element={
            <ProtectedRoute role="admin"><PacienteDetalle /></ProtectedRoute>
          } />
          <Route path="/admin/calendario" element={
            <ProtectedRoute role="admin"><Calendario /></ProtectedRoute>
          } />
          <Route path="/admin/seguridad" element={
            <ProtectedRoute role="admin"><Seguridad /></ProtectedRoute>
          } />

          <Route path="/paciente" element={
            <ProtectedRoute role="paciente"><ConsentGate><PacienteDashboard /></ConsentGate></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
