import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

import { Dashboard } from './pages/Dashboard';
import { NewWorkout } from './pages/NewWorkout';
import { EditWorkout } from './pages/EditWorkout';
import { Exercises } from './pages/Exercises';
import { Stats } from './pages/Stats';
import { Templates } from './pages/Templates';
import { Admin } from './pages/Admin';

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

export default function App() {
  const isAdmin = typeof window !== 'undefined' && localStorage.getItem('role') === 'ADMIN';

  return (
    <div className="max-w-5xl mx-auto p-4">
      <header className="mb-4 flex flex-wrap gap-3 items-center">
        <h1 className="text-lg font-semibold mr-4">Heracles</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <NavItem to="/">Dashboard</NavItem>
          <NavItem to="/new">New</NavItem>
          <NavItem to="/exercises">Exercises</NavItem>
          <NavItem to="/stats">Stats</NavItem>
          <NavItem to="/templates">Templates</NavItem>
          {isAdmin && <NavItem to="/admin">Admin</NavItem>}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewWorkout />} />
          <Route path="/workouts/:id" element={<EditWorkout />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<div>Not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

