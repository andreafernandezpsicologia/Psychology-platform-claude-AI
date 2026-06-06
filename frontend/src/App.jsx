import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/auth/Login';
import Activate from './pages/auth/Activate';
import AdminDashboard from './pages/admin/Dashboard';
import PacienteDetalle from './pages/admin/Paciente';
import PacienteDashboard from './pages/paciente/Dashboard';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/activate" element={<Activate />} />

          <Route path="/admin" element={
            <ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/paciente/:id" element={
            <ProtectedRoute role="admin"><PacienteDetalle /></ProtectedRoute>
          } />

          <Route path="/paciente" element={
            <ProtectedRoute role="paciente"><PacienteDashboard /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
