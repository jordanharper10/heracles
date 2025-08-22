import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';

type TemplateRow = {
  id: number;
  name: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type FullTemplate = {
  id: number;
  name: string;
  notes?: string | null;
  items: any[];
};

export function Templates() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  const nav = useNavigate();

  function load() {
    setLoading(true); setErr(null);
    api.get('/templates')
      .then(r => setRows(r.data))
      .catch(e => setErr(e?.response?.data?.error || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function fmt(dt?: string) {
    return dt ? new Date(dt).toLocaleString() : '-';
    // Pi locale/timezone will be used; adjust if you want UTC.
  }

  async function startFromTemplate(id: number) {
    // route to New Workout and let it pull ?templateId=...
    nav(`/new?templateId=${id}`);
  }

  async function remove(id: number) {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete(`/templates/${id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to delete');
    }
  }

  async function beginRename(r: TemplateRow) {
    setRenamingId(r.id);
    setRenameVal(r.name);
  }

  async function saveRename(id: number) {
    if (!renameVal.trim()) { alert('Name is required'); return; }
    try {
      await api.put(`/templates/${id}`, { name: renameVal.trim() });
      setRenamingId(null);
      setRenameVal('');
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to rename');
    }
  }

  async function duplicate(id: number) {
    try {
      const { data } = await api.get<FullTemplate>(`/templates/${id}`);
      const base = data.name || 'Template';
      const name = prompt('Duplicate as…', `${base} (copy)`);
      if (!name) return;
      await api.post('/templates', { name, notes: data.notes ?? null, items: data.items || [] });
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to duplicate');
    }
  }

  async function createEmpty() {
    if (!createName.trim()) { alert('Name is required'); return; }
    try {
      await api.post('/templates', { name: createName.trim(), notes: createNotes || null, items: [] });
      setCreateName(''); setCreateNotes(''); setCreating(false);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to create');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Templates</h1>
        <button className="border px-3 py-2 rounded" onClick={()=>setCreating(v=>!v)}>
          {creating ? 'Close' : 'New template'}
        </button>
      </div>

      {creating && (
        <div className="bg-white border rounded p-3 grid gap-2 md:grid-cols-2">
          <input className="border p-2" placeholder="Template name" value={createName} onChange={e=>setCreateName(e.target.value)} />
          <input className="border p-2" placeholder="Notes (optional)" value={createNotes} onChange={e=>setCreateNotes(e.target.value)} />
          <div className="md:col-span-2">
            <button className="bg-black text-white px-3 py-2 rounded" onClick={createEmpty}>Create empty template</button>
            <span className="text-sm text-gray-600 ml-2">You can fill it later from New/Edit Workout and re-save.</span>
          </div>
        </div>
      )}

      {loading && <div>Loading…</div>}
      {err && <div className="text-red-600">{err}</div>}
      {!loading && !rows.length && !err && <div>No templates yet.</div>}

      {!!rows.length && (
        <div className="bg-white border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2 w-1/3">Notes</th>
                <th className="text-left p-2">Updated</th>
                <th className="text-left p-2">Created</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2">
                    {renamingId === r.id ? (
                      <div className="flex gap-2">
                        <input className="border p-1 w-full" value={renameVal} onChange={e=>setRenameVal(e.target.value)} />
                        <button className="text-xs bg-green-600 text-white px-2 py-1 rounded" onClick={()=>saveRename(r.id)}>Save</button>
                        <button className="text-xs border px-2 py-1 rounded" onClick={()=>{ setRenamingId(null); setRenameVal(''); }}>Cancel</button>
                      </div>
                    ) : (
                      <span className="font-medium">{r.name}</span>
                    )}
                  </td>
                  <td className="p-2 text-gray-700">{r.notes || '-'}</td>
                  <td className="p-2">{fmt(r.updatedAt)}</td>
                  <td className="p-2">{fmt(r.createdAt)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button className="text-xs border px-2 py-1 rounded" onClick={()=>startFromTemplate(r.id)}>Use</button>
                      <button className="text-xs border px-2 py-1 rounded" onClick={()=>duplicate(r.id)}>Duplicate</button>
                      {renamingId !== r.id && (
                        <button className="text-xs border px-2 py-1 rounded" onClick={()=>beginRename(r)}>Rename</button>
                      )}
                      <button className="text-xs border px-2 py-1 rounded text-red-600" onClick={()=>remove(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-sm text-gray-600">
        Tip: From <strong>New Workout</strong> or <strong>Edit Workout</strong> you can “Save as template” to keep layouts you like.
      </div>
    </div>
  );
}

