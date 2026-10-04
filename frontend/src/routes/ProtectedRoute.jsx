import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import WorkspaceLoading from '../components/common/WorkspaceLoading';

function ProtectedRoute() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <WorkspaceLoading title="Verifying your account" description="Securely preparing your college workspace." />;
  }

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
