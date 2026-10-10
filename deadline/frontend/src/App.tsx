import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './components/Shell';
import { AssignmentFormPage } from './pages/AssignmentFormPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function RequireAuth(): JSX.Element {
  const auth = useAuth();
  if (!auth.ready) {
    return <p className="px-4 py-10 text-muted">Проверяем сессию</p>;
  }
  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Shell
      name={auth.user.name}
      onLogout={() => {
        void auth.logout();
      }}
    >
      <Outlet />
    </Shell>
  );
}

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/assignments/new" element={<AssignmentFormPage />} />
        <Route path="/assignments/:id" element={<AssignmentFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
