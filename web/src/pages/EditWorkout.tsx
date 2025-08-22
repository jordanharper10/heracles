import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

type Exercise = {
  id: number;
  name: string;
  category: string;
  muscleGroup?: string | null;
  equipment?: string | null;
  hasLoad?: boolean | number;
  hasReps?: boolean | number;
  hasDuration?: boolean | number;
  hasIntervals?: boolean | number;
};

type SetPayload = {
  reps?: number;
  weight?: number;
  durationSec?: number;
  distanceM?: number;
  intervals?: number;
  workSec?: number;
  restSec?: number;
  notes?: string;
};

type Item =
  | { itemType: 'exercise'; exerciseId: number; orderIndex: number; sets: SetPayload[] }
  | { itemType: 'superset' | 'circuit'; orderIndex: number; groupItems: { exerciseId: number; orderIndex: number; sets: SetPayload[] }[] };

type GroupMode = 'none' | 'muscle' | 'equipment';
type ColKey = 'reps'|'weight'|'durationSec'|'distanceM'|'intervals'|'workSec'|'restSec'|'notes';
type ColDef = { key: ColKey; label: string; isNumber?: boolean };

function splitTags(s?: string | null): string[] { return s ? s.split(',').map(x=>x.trim()).filter(Boolean) : []; }
function buildGroups(exs: Exercise[], mode: GroupMode) {
  if (mode === 'none') return { 'All exercises': exs };
  const map = new Map<string, Exercise[]>();
  for (const e of exs) {
    const tags = mode === 'muscle' ? splitTags(e.muscleGroup) : splitTags(e.equipment);
    if (tags.length === 0) map.set('Other', [ ...(map.get('Other')||[]), e ]);
    else for (const t of tags) map.set(t, [ ...(map.get(t)||[]), e ]);
  }
  const entries = Array.from(map.entries())
    .sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([label, arr]) => [label, arr.slice().sort((a,b)=>a.name.localeCompare(b.name))] as const);
  return Object.fromEntries(entries) as Record<string, Exercise[]>;
}

function numOrU(v:any){ return v===null || v===undefined || v==='' ? undefined : v; }
function swap<T>(arr:T[], i:number, j:number){ const c=[...arr]; const t=c[i]; c[i]=c[j]; c[j]=t; return c; }
function reindex(items: Item[]): Item[] {
  return items.map((it, i) => it.itemType === 'exercise'
    ? { ...it, orderIndex:i }
    : { ...it, orderIndex:i, groupItems: it.groupItems.map((g,gi)=>({ ...g, orderIndex:gi })) });
}
function reindexGroup<T extends {orderIndex:number}>(arr:T[]):T[]{ return arr.map((g,i)=>({ ...g, orderIndex:i })); }

function flags(ex?: Exercise) {
  return {
    load: !!(ex?.hasLoad),
    reps: !!(ex?.hasReps),
    duration: !!(ex?.hasDuration),
    intervals: !!(ex?.hasIntervals),
  };
}
function columnsForExercise(ex?: Exercise): ColDef[] {
  const f = flags(ex);
  const cols: ColDef[] = [];
  if (f.reps) cols.push({ key:'reps', label:'Reps', isNumber:true });
  if (f.load) cols.push({ key:'weight', label:'Weight', isNumber:true });
  if (f.duration) { cols.push({ key:'durationSec', label:'Duration (s)', isNumber:true }); cols.push({ key:'distanceM', label:'Distance (m)', isNumber:true }); }
  if (f.intervals) { cols.push({ key:'intervals', label:'Intervals', isNumber:true }); cols.push({ key:'workSec', label:'Work (s)', isNumber:true }); cols.push({ key:'restSec', label:'Rest (s)', isNumber:true }); }
  cols.push({ key:'notes', label:'Notes' });
  return cols;
}
function pruneSetByColumns(set: SetPayload, cols: ColDef[]): SetPayload {
  const keep = new Set(cols.map(c=>c.key));
  const out: SetPayload = {};
  for (const k of Object.keys(set) as ColKey[]) {
    if (keep.has(k) && numOrU((set as any)[k]) !== undefined) (out as any)[k] = (set as any)[k];
  }
  return out;
}

function NumInput({ value, onChange }:{ value?:number; onChange:(v:number|undefined)=>void }) {
  const [v, setV] = useState<string>(value==null ? '' : String(value));
  useEffect(()=>{ setV(value==null ? '' : String(value)); }, [value]);
  return <input className="border p-1 w-full text-xs" value={v} onChange={e=>{
    const raw=e.target.value; setV(raw);
    if (raw==='') onChange(undefined); else { const n=Number(raw); onChange(Number.isFinite(n)?n:undefined); }
  }}/>;
}

export function EditWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupMode, setGroupMode] = useState<GroupMode>(() => (localStorage.getItem('groupModeEdit') as GroupMode) || 'none');
  useEffect(() => { localStorage.setItem('groupModeEdit', groupMode); }, [groupMode]);

  useEffect(() => {
    (async () => {
      try {
        const [exs, w] = await Promise.all([ api.get('/exercises'), api.get(`/workouts/${id}`) ]);
        setExercises(exs.data);
        const wdata = w.data;
        setDate((wdata.date || new Date().toISOString()).slice(0, 10));
        setTitle(wdata.title || '');
        setNotes(wdata.notes || '');
        const norm: Item[] = (wdata.items || []).map((it: any, idx: number) => {
          if (it.itemType === 'exercise') {
            return { itemType: 'exercise', exerciseId: it.exerciseId, orderIndex: idx, sets: (it.sets || []) };
          }
          return {
            itemType: it.itemType,
            orderIndex: idx,
            groupItems: (it.groupItems || []).map((gi: any, gidx: number) => ({
              exerciseId: gi.exerciseId,
              orderIndex: gidx,
              sets: (gi.sets || [])
            }))
          };
        });
        setItems(norm);
      } finally { setLoading(false); }
    })();
  }, [id]);

  const groups = useMemo(() => buildGroups(exercises, groupMode), [exercises, groupMode]);
  const byId = useMemo(() => { const m=new Map<number, Exercise>(); exercises.forEach(e=>m.set(e.id,e)); return m; }, [exercises]);

  /* item ops */
  function addItemExercise(exId?: number) {
    const first = exercises.slice().sort((a,b)=>a.name.localeCompare(b.name))[0]?.id ?? 1;
    const exerciseId = exId ?? first;
    setItems(prev => [...prev, { itemType:'exercise', exerciseId, orderIndex: prev.length, sets: [] }]);
  }
  function addItemGroup(type:'superset'|'circuit') { setItems(prev => [...prev, { itemType:type, orderIndex: prev.length, groupItems: [] } as Item]); }
  function deleteItem(idx:number){ setItems(prev => reindex(prev.filter((_,i)=>i!==idx))); }
  function moveItemUp(idx:number){ if (idx>0) setItems(prev => reindex(swap(prev, idx, idx-1))); }
  function moveItemDown(idx:number){ if (idx<items.length-1) setItems(prev => reindex(swap(prev, idx, idx+1))); }
  function changeItemType(idx:number, newType:'exercise'|'superset'|'circuit'){
    setItems(prev => {
      const copy=[...prev];
      if (newType==='exercise') { const first=exercises.slice().sort((a,b)=>a.name.localeCompare(b.name))[0]?.id ?? 1;
        copy[idx] = { itemType:'exercise', exerciseId:first, orderIndex: idx, sets: [] };
      } else { copy[idx] = { itemType:newType, orderIndex: idx, groupItems: [] } as Item; }
      return copy;
    });
  }
  function changeItemExercise(idx:number, exId:number){ setItems(prev => { const c=[...prev]; const it=c[idx]; if (it.itemType==='exercise') (it as any).exerciseId=exId; return c; }); }

  /* sets (exercise item) */
  function addSet(idx:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType!=='exercise') return prev; it.sets.push({}); return c; }); }
  function updateSet(idx:number,sidx:number,patch:Partial<SetPayload>){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType!=='exercise') return prev; it.sets[sidx]={...it.sets[sidx],...patch}; return c; }); }
  function deleteSet(idx:number,sidx:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType!=='exercise') return prev; it.sets.splice(sidx,1); return c; }); }

  /* group items */
  function addGroupExercise(idx:number, exId:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems.push({ exerciseId:exId, orderIndex: it.groupItems.length, sets: [] }); return c; }); }
  function changeGroupExercise(idx:number,gidx:number, exId:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems[gidx].exerciseId=exId; return c; }); }
  function deleteGroupExercise(idx:number,gidx:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems.splice(gidx,1); it.groupItems=it.groupItems.map((g,i)=>({ ...g, orderIndex:i })); return c; }); }
  function moveGroupExercise(idx:number,gidx:number,dir:-1|1){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; const j=gidx+dir; if(j<0||j>=it.groupItems.length) return prev; it.groupItems=reindexGroup(swap(it.groupItems,gidx,j)); return c; }); }

  /* group sets */
  function addGroupSet(idx:number,gidx:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems[gidx].sets.push({}); return c; }); }
  function updateGroupSet(idx:number,gidx:number,sidx:number,patch:Partial<SetPayload>){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems[gidx].sets[sidx]={...it.groupItems[gidx].sets[sidx],...patch}; return c; }); }
  function deleteGroupSet(idx:number,gidx:number,sidx:number){ setItems(prev=>{ const c=[...prev]; const it=c[idx]; if(it.itemType==='exercise') return prev; it.groupItems[gidx].sets.splice(sidx,1); return c; }); }

  async function saveAsTemplate() {
    const name = prompt('Template name?', title || 'My template');
    if (!name) return;
    const payload = { name, notes: notes || null, items };
    await api.post('/templates', payload);
    alert('Template saved');
  }


  async function save() {
    const payloadItems = reindex(items).map((it, idx) => {
      if (it.itemType === 'exercise') {
        const ex = byId.get(it.exerciseId);
        const cols = columnsForExercise(ex);
        return { itemType:'exercise', exerciseId: it.exerciseId, orderIndex: idx, sets: it.sets.map(s=>pruneSetByColumns(s, cols)) };
      }
      return {
        itemType: it.itemType,
        orderIndex: idx,
        groupItems: it.groupItems.map((g, gi) => {
          const ex = byId.get(g.exerciseId);
          const cols = columnsForExercise(ex);
          return { exerciseId: g.exerciseId, orderIndex: gi, sets: g.sets.map(s=>pruneSetByColumns(s, cols)) };
        })
      };
    });
    await api.put(`/workouts/${id}`, { date, title: title || undefined, notes: notes || undefined, items: payloadItems });
    alert('Saved'); navigate('/');
  }

  async function remove() {
    if (!confirm('Delete this workout?')) return;
    await api.delete(`/workouts/${id}`); alert('Deleted'); navigate('/');
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit Workout</h1>

      <div className="bg-white border rounded p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-gray-700">Group by:</div>
          <select className="border p-1" value={groupMode} onChange={e=>setGroupMode(e.target.value as GroupMode)}>
            <option value="none">None</option>
            <option value="muscle">Muscle group</option>
            <option value="equipment">Equipment</option>
          </select>
        </div>

        <div className="flex gap-2">
          <input type="date" className="border p-2" value={date} onChange={e=>setDate(e.target.value)} />
          <input className="border p-2 flex-1" placeholder="Title (optional)" value={title} onChange={e=>setTitle(e.target.value)} />
        </div>
        <textarea className="border p-2 w-full" placeholder="Notes (optional)" value={notes} onChange={e=>setNotes(e.target.value)} />

        {/* Add item controls */}
        <div className="flex gap-2 flex-wrap">
          <select id="add-ex" className="border p-2 min-w-[220px]">
            {Object.entries(groups).map(([label, arr]) => (
              <optgroup key={label} label={label}>
                {arr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            ))}
          </select>
          <button className="bg-black text-white px-3 py-2 rounded" onClick={()=>{
            const sel=document.getElementById('add-ex') as HTMLSelectElement;
            const exId= sel?.value ? parseInt(sel.value) : undefined;
            addItemExercise(exId);
          }}>+ Exercise</button>
          <button className="border px-3 py-2 rounded" onClick={()=>addItemGroup('superset')}>+ Superset</button>
          <button className="border px-3 py-2 rounded" onClick={()=>addItemGroup('circuit')}>+ Circuit</button>
        </div>

        {/* Items editor */}
        {items.map((it, idx) => {
          const ex = it.itemType === 'exercise' ? byId.get((it as any).exerciseId) : undefined;
          const cols = it.itemType === 'exercise' ? columnsForExercise(ex) : undefined;

          return (
            <div key={idx} className="border rounded p-3 mb-2">
              <div className="flex items-center gap-2 justify-between">
                <div className="font-medium">{it.itemType.toUpperCase()}</div>
                <div className="flex gap-2">
                  <button className="text-xs border px-2 py-1 rounded" onClick={()=>moveItemUp(idx)}>↑</button>
                  <button className="text-xs border px-2 py-1 rounded" onClick={()=>moveItemDown(idx)}>↓</button>
                  <button className="text-xs border px-2 py-1 rounded text-red-600" onClick={()=>deleteItem(idx)}>Delete</button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 items-center">
                <label className="text-sm">Type:</label>
                <select className="border p-1" value={it.itemType} onChange={e=>changeItemType(idx, e.target.value as any)}>
                  <option value="exercise">exercise</option>
                  <option value="superset">superset</option>
                  <option value="circuit">circuit</option>
                </select>

                {it.itemType === 'exercise' && (
                  <>
                    <label className="text-sm ml-2">Exercise:</label>
                    <select className="border p-1"
                      value={(it as any).exerciseId}
                      onChange={e=>changeItemExercise(idx, parseInt(e.target.value))}>
                      {Object.entries(groups).map(([label, arr]) => (
                        <optgroup key={label} label={label}>
                          {arr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </>
                )}
              </div>

              {/* dynamic set table for exercise items */}
              {it.itemType === 'exercise' && (
                <div className="mt-3">
                  <div className="text-sm font-medium mb-1">Sets</div>
                  <button className="text-xs border px-2 py-1 rounded" onClick={()=>addSet(idx)}>+ Add set</button>
                  <table className="mt-2 w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        {cols!.map(c => <th key={c.key} className="p-1">{c.label}</th>)}
                        <th className="p-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {it.sets.map((s, sidx) => (
                        <tr key={sidx} className="border-t">
                          {cols!.map(c => (
                            <td key={c.key} className="p-1">
                              {c.key === 'notes' ? (
                                <input className="border p-1 w-full text-xs" value={s.notes||''}
                                       onChange={e=>updateSet(idx, sidx, { notes: e.target.value || undefined })} />
                              ) : (
                                <NumInput value={(s as any)[c.key]} onChange={v=>updateSet(idx, sidx, { [c.key]: v } as any)} />
                              )}
                            </td>
                          ))}
                          <td className="p-1 text-right">
                            <button className="text-xs text-red-600" onClick={()=>deleteSet(idx, sidx)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* group editor */}
              {(it.itemType === 'superset' || it.itemType === 'circuit') && (
                <div className="mt-3 space-y-3">
                  <div className="flex gap-2 items-center">
                    <label className="text-sm">Add exercise to {it.itemType}:</label>
                    <select id={`gsel-${idx}`} className="border p-1 min-w-[220px]">
                      {Object.entries(groups).map(([label, arr]) => (
                        <optgroup key={label} label={label}>
                          {arr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <button className="text-xs border px-2 py-1 rounded" onClick={()=>{
                      const sel = document.getElementById(`gsel-${idx}`) as HTMLSelectElement;
                      if (sel?.value) addGroupExercise(idx, parseInt(sel.value));
                    }}>Add</button>
                  </div>

                  {(it.groupItems || []).map((gi, gidx) => {
                    const gEx = byId.get(gi.exerciseId);
                    const gCols = columnsForExercise(gEx);
                    return (
                      <div key={gidx} className="border rounded p-2">
                        <div className="flex items-center gap-2 justify-between">
                          <div className="text-sm font-medium">Exercise #{gidx+1}</div>
                          <div className="flex items-center gap-2">
                            <button className="text-xs border px-2 py-1 rounded" onClick={()=>moveGroupExercise(idx, gidx, -1)}>↑</button>
                            <button className="text-xs border px-2 py-1 rounded" onClick={()=>moveGroupExercise(idx, gidx, +1)}>↓</button>
                            <button className="text-xs text-red-600" onClick={()=>deleteGroupExercise(idx, gidx)}>Remove</button>
                          </div>
                        </div>

                        <div className="mt-2">
                          <label className="text-sm mr-2">Exercise:</label>
                          <select className="border p-1"
                            value={gi.exerciseId}
                            onChange={e=>changeGroupExercise(idx, gidx, parseInt(e.target.value))}>
                            {Object.entries(groups).map(([label, arr]) => (
                              <optgroup key={label} label={label}>
                                {arr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        </div>

                        <div className="mt-2">
                          <div className="text-xs font-medium mb-1">Sets</div>
                          <button className="text-xs border px-2 py-1 rounded" onClick={()=>addGroupSet(idx, gidx)}>+ Add set</button>
                          <table className="mt-2 w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                {gCols.map(c => <th key={c.key} className="p-1">{c.label}</th>)}
                                <th className="p-1"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {gi.sets.map((s, sidx) => (
                                <tr key={sidx} className="border-t">
                                  {gCols.map(c => (
                                    <td key={c.key} className="p-1">
                                      {c.key === 'notes' ? (
                                        <input className="border p-1 w-full text-xs" value={s.notes||''}
                                               onChange={e=>updateGroupSet(idx, gidx, sidx, { notes: e.target.value || undefined })} />
                                      ) : (
                                        <NumInput value={(s as any)[c.key]} onChange={v=>updateGroupSet(idx, gidx, sidx, { [c.key]: v } as any)} />
                                      )}
                                    </td>
                                  ))}
                                  <td className="p-1 text-right">
                                    <button className="text-xs text-red-600" onClick={()=>deleteGroupSet(idx, gidx, sidx)}>Delete</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex gap-2">
          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={save}>Save</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={remove}>Delete</button>
          <button className="border px-4 py-2 rounded" onClick={saveAsTemplate}>Save as template</button>

        </div>
      </div>
    </div>
  );
}

