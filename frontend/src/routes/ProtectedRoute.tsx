import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/shared/LoadingSpinner';

interface Props {
  children?: React.ReactNode;
  permission?: string;
}

/**
 * ProtectedRoute — wraps routes requiring authentication.
 * Can be used two ways:
 *   1. As a layout route: <Route element={<ProtectedRoute />}> — renders <Outlet />
 *   2. With children: <ProtectedRoute permission="X"><Page /></ProtectedRoute>
 */
export function ProtectedRoute({ children, permission }: Props) {
  const { isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 p-8">
        <p className="text-lg font-medium text-slate-700">Access Denied</p>
        <p className="text-sm text-slate-500">You do not have permission to view this page.</p>
      </div>
    );
  }

  // If children are provided, render them. Otherwise render Outlet for layout routes.
  return <>{children ?? <Outlet />}</>;
}
