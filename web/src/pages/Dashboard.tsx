import React, { useEffect, useState } from 'react';
import { api } from '../api';

type Workout = {
  id: number;
  date: string;
  title?: string | null;
  notes?: string | null;
  exerciseNames?: string[];
};

export function Dashboard() {
  const [recent, setRecent] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/workouts', { params: { summary: 1 } });
        setRecent((data as Workout[]).slice(0, 12));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Recent Workouts</h1>
      {recent.length === 0 ? (
        <div className="text-gray-600">
          No workouts yet. Head to <span className="font-medium">New Workout</span> to log one.
        </div>
      ) : (
        <ul className="space-y-2">
          {recent.map(w => (
            <li key={w.id} className="bg-white p-3 rounded border">
              <div className="font-medium">{new Date(w.date).toDateString()}</div>
              {w.title && <div className="text-sm text-gray-600">{w.title}</div>}

              {/* NEW: exercise list */}
              {w.exerciseNames && w.exerciseNames.length > 0 && (
                <div className="mt-1 text-sm text-gray-700">
                  {formatNames(w.exerciseNames, 6)}
                </div>
              )}

              {w.notes && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{w.notes}</div>}

              <div className="mt-2">
                <a className="text-blue-600 text-sm underline" href={`/edit/${w.id}`}>Edit</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatNames(names: string[], max: number) {
  if (names.length <= max) return names.join(', ');
  const shown = names.slice(0, max).join(', ');
  const more = names.length - max;
  return `${shown} +${more} more`;
}

