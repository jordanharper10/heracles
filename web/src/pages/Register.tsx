import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuthToken } from '../api';

export function Register() {
  const nav = useNavigate();
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [err, setErr] = useState<string|null>(null);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    setErr(null);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      setAuthToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      nav('/');
    } catch (e:any) {
      setErr(e?.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 bg-white p-6 rounded border">
      <h1 className="text-xl font-semibold mb-4">Register</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="border p-2 w-full" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border p-2 w-full" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button className="bg-green-600 text-white w-full py-2 rounded">Create account</button>
      </form>
      <div className="mt-3 text-sm">Have an account? <Link to="/login" className="text-blue-600">Login</Link></div>
    </div>
  );
}

