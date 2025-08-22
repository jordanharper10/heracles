import React, { useEffect, useState } from 'react';
import { api } from '../api';

type Exercise = {
  id: number;
  name: string;
  category: 'weights'|'cardio'|'hiit'|'plyometric'|'mobility'|string;
  muscleGroup?: string | null;
  equipment?: string | null;
  youtubeUrl?: string | null;
  hasLoad?: number | boolean;
  hasReps?: number | boolean;
  hasDuration?: number | boolean;
  hasIntervals?: number | boolean;
};

export function Exercises() {
  const [list, setList] = useState<Exercise[]>([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  // edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  // create form
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Exercise['category']>('weights');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  const [flags, setFlags] = useState({ hasLoad:false, hasReps:false, hasDuration:false, hasIntervals:false });

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })();

  function refresh() { api.get('/exercises').then(r => setList(r.data)); }
  useEffect(() => { refresh(); }, []);

  const filtered = list.filter(x =>
    x.name.toLowerCase().includes(q.toLowerCase()) ||
    (x.muscleGroup||'').toLowerCase().includes(q.toLowerCase()) ||
    (x.equipment||'').toLowerCase().includes(q.toLowerCase())
  );

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/exercises', {
        name, category,
        muscleGroup: muscleGroup || undefined,
        equipment: equipment || undefined,
        youtubeUrl: youtubeUrl || undefined,
        ...flags
      });
      setName(''); setYoutubeUrl(''); setMuscleGroup(''); setEquipment('');
      setFlags({ hasLoad:false, hasReps:false, hasDuration:false, hasIntervals:false });
      setAdding(false);
      refresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add exercise');
    }
  }

  function startEdit(ex: Exercise) {
    setEditingId(ex.id);
    setEditForm({
      name: ex.name,
      category: ex.category,
      muscleGroup: ex.muscleGroup || '',
      equipment: ex.equipment || '',
      youtubeUrl: ex.youtubeUrl || '',
      hasLoad: !!ex.hasLoad,
      hasReps: !!ex.hasReps,
      hasDuration: !!ex.hasDuration,
      hasIntervals: !!ex.hasIntervals
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    const payload: any = {};
    for (const [k, v] of Object.entries(editForm)) {
      if (k === 'muscleGroup' || k === 'equipment' || k === 'youtubeUrl') {
        payload[k] = (v as string).trim() ? v : undefined;
      } else {
        payload[k] = v;
      }
    }
    try {
      await api.put(`/exercises/${editingId}`, payload);
      setEditingId(null);
      refresh();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to update exercise');
    }
  }

  async function deleteExercise(id: number) {
    if (!confirm('Delete this exercise?')) return;
    try {
      await api.delete(`/exercises/${id}`);
      refresh();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to delete exercise');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <input
          className="border p-2 flex-1"
          placeholder="Search by name, muscle group, or equipment…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        {user?.role === 'ADMIN' && (
          <button className="border px-3 py-2 rounded" onClick={()=>setAdding(v=>!v)}>
            {adding ? 'Close' : 'Add exercise'}
          </button>
        )}
      </div>

      {adding && user?.role === 'ADMIN' && (
        <form onSubmit={submitCreate} className="bg-white p-4 border rounded grid gap-3 md:grid-cols-2">
          <input required className="border p-2" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <select className="border p-2" value={category} onChange={e=>setCategory(e.target.value as any)}>
            <option value="weights">weights</option>
            <option value="cardio">cardio</option>
            <option value="hiit">hiit</option>
            <option value="plyometric">plyometric</option>
            <option value="mobility">mobility</option>
          </select>
          <input className="border p-2" placeholder="Muscle group (optional)" value={muscleGroup} onChange={e=>setMuscleGroup(e.target.value)} />
          <input className="border p-2" placeholder="Equipment (optional)" value={equipment} onChange={e=>setEquipment(e.target.value)} />
          <input className="border p-2 md:col-span-2" placeholder="YouTube URL (optional)" value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} />
          <div className="flex gap-4 md:col-span-2 text-sm">
            {['hasLoad','hasReps','hasDuration','hasIntervals'].map(k=>(
              <label key={k} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={(flags as any)[k]}
                  onChange={e=>setFlags(prev => ({...prev, [k]: e.target.checked}))}
                />
                {k}
              </label>
            ))}
          </div>
          <div className="md:col-span-2">
            <button className="bg-black text-white px-4 py-2 rounded">Save</button>
          </div>
        </form>
      )}

      {/* Compact, dense grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {filtered.map(e => (
          <div key={e.id} className="bg-white p-2 rounded border text-sm">
            {editingId === e.id ? (
              <>
                <div className="font-medium mb-1">Editing: {e.name}</div>
                <div className="grid gap-2">
                  <input className="border p-1" value={editForm.name} onChange={ev=>setEditForm({...editForm, name: ev.target.value})} />
                  <select className="border p-1" value={editForm.category} onChange={ev=>setEditForm({...editForm, category: ev.target.value})}>
                    <option value="weights">weights</option>
                    <option value="cardio">cardio</option>
                    <option value="hiit">hiit</option>
                    <option value="plyometric">plyometric</option>
                    <option value="mobility">mobility</option>
                  </select>
                  <input className="border p-1" placeholder="Muscle group" value={editForm.muscleGroup} onChange={ev=>setEditForm({...editForm, muscleGroup: ev.target.value})}/>
                  <input className="border p-1" placeholder="Equipment" value={editForm.equipment} onChange={ev=>setEditForm({...editForm, equipment: ev.target.value})}/>
                  <input className="border p-1" placeholder="YouTube URL" value={editForm.youtubeUrl} onChange={ev=>setEditForm({...editForm, youtubeUrl: ev.target.value})}/>
                  <div className="flex flex-wrap gap-3">
                    {(['hasLoad','hasReps','hasDuration','hasIntervals'] as const).map(k=>(
                      <label key={k} className="flex items-center gap-1">
                        <input type="checkbox" checked={!!editForm[k]} onChange={ev=>setEditForm({...editForm, [k]: ev.target.checked})}/> {k}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="bg-green-600 text-white px-2 py-1 rounded" onClick={saveEdit}>Save</button>
                  <button className="border px-2 py-1 rounded" onClick={()=>setEditingId(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="font-medium truncate" title={e.name}>{e.name}</div>
                <div className="text-xs text-gray-600">
                  {e.category}{e.muscleGroup ? ` • ${e.muscleGroup}` : ''}
                </div>

                {/* NEW: equipment line */}
                {e.equipment && (
                  <div className="text-xs text-gray-700 mt-1">
                    Equipment: <span className="font-medium">{e.equipment}</span>
                  </div>
                )}

                <div className="mt-1 flex items-center justify-between">
                  {e.youtubeUrl && (
                    <a className="text-blue-600 text-xs underline" href={e.youtubeUrl} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  )}
                  {/* admin actions */}
                  {user?.role === 'ADMIN' && (
                    <div className="flex gap-1">
                      <button className="text-xs border px-2 py-0.5 rounded" onClick={()=>startEdit(e)}>Edit</button>
                      <button className="text-xs border px-2 py-0.5 rounded text-red-600" onClick={()=>deleteExercise(e.id)}>Delete</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

