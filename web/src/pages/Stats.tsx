import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip,
} from 'recharts';

type StatsResponse = {
  volumeByDay: Record<string, number>;
  cardioDurationByDay: Record<string, number>;
};

type Exercise = {
  id: number;
  name: string;
  hasLoad?: number | boolean;
  hasDuration?: number | boolean;
  muscleGroup?: string | null;
  equipment?: string | null;
};

type GroupMode = 'none' | 'muscle' | 'equipment';

function splitTags(s?: string | null): string[] {
  if (!s) return [];
  return s.split(',').map(x => x.trim()).filter(Boolean);
}
function buildGroups(exs: Exercise[], mode: GroupMode) {
  if (mode === 'none') return { 'All exercises': exs };
  const map = new Map<string, Exercise[]>();
  for (const e of exs) {
    const tags = mode === 'muscle' ? splitTags(e.muscleGroup) : splitTags(e.equipment);
    if (tags.length === 0) {
      map.set('Other', [...(map.get('Other') || []), e]);
    } else {
      for (const tRaw of tags) {
        map.set(tRaw, [...(map.get(tRaw) || []), e]);
      }
    }
  }
  const groups = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, items]) => [label, items.slice().sort((a, b) => a.name.localeCompare(b.name))] as const);
  return Object.fromEntries(groups) as Record<string, Exercise[]>;
}

export function Stats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // progression state
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [groupMode, setGroupMode] = useState<GroupMode>(() => (localStorage.getItem('groupModeStats') as GroupMode) || 'none');
  const [selected, setSelected] = useState<number | ''>('');
  const [progression, setProgression] = useState<{ mode: 'load' | 'duration'; name: string; data: any[] } | null>(null);
  const [loadingProg, setLoadingProg] = useState(false);

  useEffect(() => { localStorage.setItem('groupModeStats', groupMode); }, [groupMode]);

  useEffect(() => {
    (async () => {
      try {
        const [s, exs] = await Promise.all([
          api.get('/workouts/stats'),
          api.get('/exercises')
        ]);
        setStats(s.data);
        setExercises(exs.data);
      } catch (e: any) {
        setErr(e?.response?.data?.error || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const volData = useMemo(
    () => (stats ? Object.entries(stats.volumeByDay).map(([date, vol]) => ({ date, vol })) : []),
    [stats]
  );

  const cardioData = useMemo(
    () => (stats ? Object.entries(stats.cardioDurationByDay).map(([date, sec]) => ({ date, sec })) : []),
    [stats]
  );

  const groups = useMemo(() => buildGroups(exercises, groupMode), [exercises, groupMode]);

  async function fetchProgression(exerciseId: number) {
    setLoadingProg(true);
    try {
      const { data } = await api.get('/workouts/stats/progression', { params: { exerciseId } });
      setProgression({ mode: data.mode, name: data.name, data: data.data });
    } finally {
      setLoadingProg(false);
    }
  }

  function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (!v) { setSelected(''); setProgression(null); return; }
    const id = parseInt(v, 10);
    setSelected(id);
    fetchProgression(id);
  }

  if (loading) return <div>Loading…</div>;
  if (err) return <div className="text-red-600">{err}</div>;
  if (!stats) return <div>No data yet — log a workout to see stats.</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Statistics</h1>

      {/* Daily volume */}
      <div className="bg-white p-4 border rounded">
        <div className="font-medium mb-2">Daily Volume (kg × reps)</div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={volData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="vol" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cardio duration */}
      <div className="bg-white p-4 border rounded">
        <div className="font-medium mb-2">Cardio Duration (seconds)</div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={cardioData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="sec" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-exercise progression */}
      <div className="bg-white p-4 border rounded">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="font-medium">Exercise progression</div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-700">Group by:</span>
            <select className="border p-1" value={groupMode} onChange={e=>setGroupMode(e.target.value as GroupMode)}>
              <option value="none">None</option>
              <option value="muscle">Muscle group</option>
              <option value="equipment">Equipment</option>
            </select>
            <select className="border p-2 min-w-[220px]" value={selected} onChange={onSelectChange}>
              <option value="">— choose exercise —</option>
              {Object.entries(groups).map(([label, arr]) => (
                <optgroup key={label} label={label}>
                  {arr.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {!selected && <div className="text-sm text-gray-600">Pick an exercise to see your trend.</div>}
        {selected && loadingProg && <div>Loading…</div>}
        {selected && !loadingProg && progression && progression.data.length === 0 && (
          <div className="text-sm text-gray-600">No logged sets for this exercise yet.</div>
        )}

        {selected && !loadingProg && progression && progression.data.length > 0 && (
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              {progression.mode === 'load' ? (
                <LineChart data={progression.data}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  {/* Epley est. 1RM and top set weight */}
                  <Line type="monotone" dataKey="est1rm" />
                  <Line type="monotone" dataKey="topWeight" />
                </LineChart>
              ) : (
                <LineChart data={progression.data}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="durationSec" />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

