// web/src/pages/Login.tsx
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { setAuth } from '../auth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from || '/';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (!data?.token || !data?.user) throw new Error('Invalid response');
      setAuth(data.token, data.user);
      nav(from, { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-4 border rounded bg-white space-y-3">
      <h1 className="text-lg font-semibold">Log in</h1>
      {err && <div className="text-red-600 text-sm">{err}</div>}
      <form className="space-y-3" onSubmit={onSubmit}>
        <div className="grid gap-1">
          <label className="text-sm">Email</label>
          <input className="border p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="grid gap-1">
          <label className="text-sm">Password</label>
          <input className="border p-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="bg-black text-white px-3 py-2 rounded w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

