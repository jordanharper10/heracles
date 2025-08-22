import React, { useEffect, useState } from 'react';
import { api } from '../api';

type User = { id:number; email:string; name:string; role:'USER'|'ADMIN'; createdAt?:string };

export function Admin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const me = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null') as User | null; } catch { return null; }
  })();

  const [editingId, setEditingId] = useState<number|null>(null);
  const [form, setForm] = useState({ name:'', email:'', role:'USER', password:'' });

  function load() {
    setLoading(true); setErr(null);
    api.get('/admin/users')
      .then(r => setUsers(r.data))
      .catch(e => setErr(e?.response?.data?.error || 'Failed to load users'))
      .finally(()=>setLoading(false));
  }

  useEffect(()=>{ load(); }, []);

  function startEdit(u:User) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, password:'' });
  }

  async function saveEdit() {
    if (!editingId) return;
    const payload:any = {};
    if (form.name.trim() !== users.find(u=>u.id===editingId)?.name) payload.name = form.name.trim();
    if (form.email.trim() !== users.find(u=>u.id===editingId)?.email) payload.email = form.email.trim();
    if (form.role !== users.find(u=>u.id===editingId)?.role) payload.role = form.role;
    if (form.password.trim()) payload.password = form.password.trim();

    try {
      await api.put(`/admin/users/${editingId}`, payload);
      setEditingId(null);
      setForm({ name:'', email:'', role:'USER', password:'' });
      load();
    } catch (e:any) {
      alert(e?.response?.data?.error || 'Failed to update user');
    }
  }

  async function delUser(id:number) {
    if (!confirm('Delete this user? This will remove all their workouts.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      load();
    } catch (e:any) {
      alert(e?.response?.data?.error || 'Failed to delete user');
    }
  }

  if (loading) return <div>Loading…</div>;
  if (err) return <div className="text-red-600">{err}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Users</h1>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Role</th>
              <th className="text-left p-2">Created</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t align-top">
                <td className="p-2">
                  {editingId===u.id ? (
                    <input className="border p-1 w-full" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
                  ) : u.name}
                </td>
                <td className="p-2">
                  {editingId===u.id ? (
                    <input className="border p-1 w-full" value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/>
                  ) : u.email}
                </td>
                <td className="p-2">
                  {editingId===u.id ? (
                    <select className="border p-1" value={form.role} onChange={e=>setForm({...form, role:e.target.value as any})}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : u.role}
                </td>
                <td className="p-2">{u.createdAt ? new Date(u.createdAt).toLocaleString() : '-'}</td>
                <td className="p-2">
                  {editingId===u.id ? (
                    <div className="flex gap-2 items-center">
                      <input className="border p-1 text-xs" type="password" placeholder="New password (optional)" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
                      <button className="text-xs bg-green-600 text-white px-2 py-1 rounded" onClick={saveEdit}>Save</button>
                      <button className="text-xs border px-2 py-1 rounded" onClick={()=>{ setEditingId(null); setForm({ name:'', email:'', role:'USER', password:'' }); }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="text-xs border px-2 py-1 rounded" onClick={()=>startEdit(u)}>Edit</button>
                      <button
                        className="text-xs border px-2 py-1 rounded text-red-600"
                        onClick={()=>delUser(u.id)}
                        disabled={me?.id === u.id}
                        title={me?.id===u.id ? 'You cannot delete your own account' : ''}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

