import 'resize-observer-polyfill';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import './index.css';
import App from './App';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

const root = createRoot(document.getElementById('root')!);
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/*" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

