import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthed } from '../auth';

export function RequireAuth({ children }: { children: React.ReactElement }) {
  if (!isAuthed()) {
    const loc = useLocation();
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return children;
}

