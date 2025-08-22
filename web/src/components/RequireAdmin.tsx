import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getUser } from '../auth';

export function RequireAdmin({ children }: { children: React.ReactElement }) {
  const user = getUser();
  const isAdmin = user?.role === 'ADMIN';
  const loc = useLocation();

  if (!user) {
    // not logged in → go to login
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  if (!isAdmin) {
    // logged in but not admin → go home (or show 403 if you prefer)
    return <Navigate to="/" replace />;
  }
  return children;
}

