import React from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';

import { Dashboard } from './pages/Dashboard';
import { NewWorkout } from './pages/NewWorkout';
import { EditWorkout } from './pages/EditWorkout';
import { Exercises } from './pages/Exercises';
import { Stats } from './pages/Stats';
import { Templates } from './pages/Templates';
import { Login } from './pages/Login';
import { RequireAuth } from './components/RequireAuth';
import { RequireAdmin } from './components/RequireAdmin';
import { clearAuth, getUser } from './auth';
import { Admin } from './pages/Admin';
import { isAuthed } from './auth';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-2 py-1 rounded ${isActive ? 'bg-black text-white' : 'underline'}`
      }
      end
    >
      {children}
    </NavLink>
  );
}

function HomeGate() {
  return isAuthed() ? <Dashboard /> : <Navigate to="/login" replace />;
}

export default function App() {
  const nav = useNavigate();
  const user = getUser();
  const isAdmin = user?.role === 'ADMIN';

  function onLogout() {
    clearAuth();
    nav('/login', { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold mr-2">Heracles</h1>
          {user && (
            <nav className="flex flex-wrap gap-2 text-sm">
              <NavItem to="/">Dashboard</NavItem>
              <NavItem to="/new">New</NavItem>
              <NavItem to="/exercises">Exercises</NavItem>
              <NavItem to="/stats">Stats</NavItem>
              <NavItem to="/templates">Templates</NavItem>
              {isAdmin && <NavItem to="/admin">Admin</NavItem>}
            </nav>
          )}
        </div>

        <div className="text-sm">
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-gray-700">{user.name}</span>
              <button className="border px-3 py-1 rounded" onClick={onLogout}>Log out</button>
            </div>
          ) : (
            <NavLink to="/login" className="underline">Log in</NavLink>
          )}
        </div>
      </header>

      <main>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Root gate */}
          <Route path="/" element={<HomeGate />} />

          {/* Protected user routes */}
          <Route path="/new" element={<RequireAuth><NewWorkout /></RequireAuth>} />
          <Route path="/workouts/:id" element={<RequireAuth><EditWorkout /></RequireAuth>} />
          <Route path="/exercises" element={<RequireAuth><Exercises /></RequireAuth>} />
          <Route path="/stats" element={<RequireAuth><Stats /></RequireAuth>} />
          <Route path="/templates" element={<RequireAuth><Templates /></RequireAuth>} />

          {/* Admin-only */}
          <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />

          {/* Fallback */}
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

