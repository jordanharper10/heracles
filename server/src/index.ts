import express, { Request, Response } from 'express';
import cors from 'cors';
import { env } from './env.js';
import { getDb, all, one, run, saveDb } from './db/sql.js';
import { requireAuth, requireAdmin, signToken } from './auth.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/', async (_req: Request, res: Response) => {
  await getDb();
  res.json({ ok: true, service: 'heracles' });
});

/* ---------- AUTH ---------- */
const RegisterSchema = z.object({ email:z.string().email(), name:z.string().min(1), password:z.string().min(6) });
const LoginSchema = z.object({ email:z.string().email(), password:z.string().min(6) });

app.post('/api/auth/register', async (req, res) => {
  await getDb();
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { email, name, password } = parsed.data;

  if (one('SELECT id FROM users WHERE email=?',[email])) return res.status(409).json({ error: 'Email already registered' });
  const hash = await bcrypt.hash(password, 10);
  run('INSERT INTO users (email,name,password,role) VALUES (?,?,?,?)', [email,name,hash,'USER']);
  saveDb();
  const user = one<any>('SELECT id,email,name,role FROM users WHERE email=?',[email])!;
  const token = signToken({ id:user.id, email:user.email, role:user.role });
  res.json({ token, user });
});

app.post('/api/auth/login', async (req, res) => {
  await getDb();
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { email, password } = parsed.data;

  const user = one<any>('SELECT * FROM users WHERE email=?',[email]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ id:user.id, email:user.email, role:user.role });
  res.json({ token, user: { id:user.id, email:user.email, name:user.name, role:user.role } });
});

/* ---------- EXERCISES ---------- */
const ExerciseSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['weights','cardio','hiit','plyometric','mobility']),
  muscleGroup: z.string().optional(),
  equipment: z.string().optional(),
  youtubeUrl: z.string().url().optional(),
  hasLoad: z.boolean().default(false),
  hasReps: z.boolean().default(false),
  hasDuration: z.boolean().default(false),
  hasIntervals: z.boolean().default(false)
});

app.get('/api/exercises', requireAuth, async (_req, res) => {
  await getDb();
  res.json(all('SELECT * FROM exercises ORDER BY name ASC'));
});

app.post('/api/exercises', requireAuth, requireAdmin, async (req, res) => {
  await getDb();
  const parsed = ExerciseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const d = parsed.data;
  run(
    `INSERT INTO exercises
     (name,category,muscleGroup,equipment,youtubeUrl,createdById,hasLoad,hasReps,hasDuration,hasIntervals)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [d.name,d.category,d.muscleGroup||null,d.equipment||null,d.youtubeUrl||null,req.user.id,
     d.hasLoad?1:0,d.hasReps?1:0,d.hasDuration?1:0,d.hasIntervals?1:0]
  );
  saveDb();
  res.json({ ok: true });
});

// UPDATE exercise (admin only)
app.put('/api/exercises/:id', requireAuth, requireAdmin, async (req, res) => {
  await getDb();

  // Reuse ExerciseSchema but make fields optional for partial update:
  const PartialExercise = ExerciseSchema.partial();
  const parsed = PartialExercise.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const d = parsed.data;

  // Build dynamic update
  const fields: string[] = [];
  const vals: any[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (v === undefined) continue;
    if (typeof v === 'boolean') {
      fields.push(`${k}=?`);
      vals.push(v ? 1 : 0);
    } else {
      fields.push(`${k}=?`);
      vals.push(v);
    }
  }
  if (fields.length === 0) return res.json({ ok: true }); // nothing to update

  vals.push(Number(req.params.id));
  run(`UPDATE exercises SET ${fields.join(', ')}, updatedAt=datetime('now') WHERE id=?`, vals);
  saveDb();
  res.json({ ok: true });
});

app.delete('/api/exercises/:id', requireAuth, requireAdmin, async (req, res) => {
  await getDb();
  run('DELETE FROM exercises WHERE id=?',[Number(req.params.id)]);
  saveDb();
  res.json({ ok: true });
});

/* ---------- WORKOUTS ---------- */
const SetSchema = z.object({
  reps: z.number().optional(),
  weight: z.number().optional(),
  durationSec: z.number().optional(),
  distanceM: z.number().optional(),
  intervals: z.number().optional(),
  workSec: z.number().optional(),
  restSec: z.number().optional(),
  notes: z.string().optional()
});
const Payload = z.object({
  date: z.string(),
  title: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    itemType: z.enum(['exercise','superset','circuit']),
    exerciseId: z.number().optional(),
    orderIndex: z.number().default(0),
    sets: z.array(SetSchema).default([]),
    groupItems: z.array(z.object({
      exerciseId: z.number(),
      orderIndex: z.number().default(0),
      sets: z.array(SetSchema).default([])
    })).default([])
  }))
});

app.get('/api/workouts', requireAuth, async (req, res) => {
  await getDb();
  const { from, to, summary } = req.query;
  const where = ['userId=?']; const params:any[] = [req.user.id];
  if (from) { where.push('date>=?'); params.push(String(from)); }
  if (to)   { where.push('date<=?'); params.push(String(to)); }

  const list = all<any>(`SELECT * FROM workouts WHERE ${where.join(' AND ')} ORDER BY date DESC`, params);

  // If no summary requested, return as-is
  if (!summary) return res.json(list);

  // Attach exercise names (from both workout_items and group_items)
  const withSummary = list.map(w => {
    const names = new Set<string>();

    // direct exercise items
    const its = all<any>('SELECT exerciseId FROM workout_items WHERE workoutId=? AND exerciseId IS NOT NULL', [w.id]);
    if (its.length) {
      const ids = its.map((r:any)=>r.exerciseId);
      if (ids.length) {
        const rows = all<any>(`SELECT name FROM exercises WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
        rows.forEach((r:any)=>names.add(r.name));
      }
    }

    // group items (supersets/circuits)
    const gis = all<any>('SELECT gi.exerciseId FROM workout_items wi JOIN group_items gi ON gi.workoutItemId=wi.id WHERE wi.workoutId=?', [w.id]);
    if (gis.length) {
      const ids = gis.map((r:any)=>r.exerciseId);
      const rows = all<any>(`SELECT name FROM exercises WHERE id IN (${ids.map(()=>'?').join(',')})`, ids);
      rows.forEach((r:any)=>names.add(r.name));
    }

    return { ...w, exerciseNames: Array.from(names) };
  });

  res.json(withSummary);
});

app.post('/api/workouts', requireAuth, async (req, res) => {
  await getDb();
  const parsed = Payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { date, title, notes, items } = parsed.data;

  run('INSERT INTO workouts (userId,date,title,notes) VALUES (?,?,?,?)',
      [req.user.id, date, title||null, notes||null]);
  const w = one<any>('SELECT * FROM workouts WHERE rowid=last_insert_rowid()');

  for (const it of items) {
    run('INSERT INTO workout_items (workoutId,itemType,exerciseId,orderIndex) VALUES (?,?,?,?)',
        [w!.id, it.itemType, it.exerciseId ?? null, it.orderIndex]);
    const wi = one<any>('SELECT * FROM workout_items WHERE rowid=last_insert_rowid()');

    if (it.itemType === 'exercise') {
      for (const s of it.sets) {
        run('INSERT INTO sets (workoutItemId,reps,weight,durationSec,distanceM,intervals,workSec,restSec,notes) VALUES (?,?,?,?,?,?,?,?,?)',
          [wi!.id,s.reps??null,s.weight??null,s.durationSec??null,s.distanceM??null,s.intervals??null,s.workSec??null,s.restSec??null,s.notes??null]);
      }
    } else {
      for (const gi of it.groupItems) {
        run('INSERT INTO group_items (workoutItemId,exerciseId,orderIndex) VALUES (?,?,?)',
            [wi!.id, gi.exerciseId, gi.orderIndex]);
        const g = one<any>('SELECT * FROM group_items WHERE rowid=last_insert_rowid()');
        for (const s of gi.sets) {
          run('INSERT INTO sets (groupItemId,reps,weight,durationSec,distanceM,intervals,workSec,restSec,notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [g!.id,s.reps??null,s.weight??null,s.durationSec??null,s.distanceM??null,s.intervals??null,s.workSec??null,s.restSec??null,s.notes??null]);
        }
      }
    }
  }

  saveDb();
  res.json({ ok:true, workoutId: w!.id });
});

/* ---------- WORKOUT VIEW / EDIT / DELETE ---------- */

// helper: check owner or admin
function canEditWorkout(user: {id:number; role:string}, workout: any) {
  return user.role === 'ADMIN' || workout.userId === user.id;
}

// GET one workout with nested items/sets
app.get('/api/workouts/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const w = one<any>('SELECT * FROM workouts WHERE id=?', [Number(req.params.id)]);
  if (!w || !canEditWorkout(req.user, w)) return res.status(404).json({ error: 'Not found' });

  const items = all<any>('SELECT * FROM workout_items WHERE workoutId=? ORDER BY orderIndex ASC', [w.id]);
  for (const it of items) {
    if (it.itemType === 'exercise') {
      it.sets = all<any>('SELECT * FROM sets WHERE workoutItemId=?', [it.id]);
    } else {
      it.groupItems = all<any>('SELECT * FROM group_items WHERE workoutItemId=? ORDER BY orderIndex ASC', [it.id]);
      for (const gi of it.groupItems) {
        gi.sets = all<any>('SELECT * FROM sets WHERE groupItemId=?', [gi.id]);
      }
    }
  }
  res.json({ ...w, items });
});

// PUT replace a workout
app.put('/api/workouts/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const w = one<any>('SELECT * FROM workouts WHERE id=?', [Number(req.params.id)]);
  if (!w || !canEditWorkout(req.user, w)) return res.status(404).json({ error: 'Not found' });

  const parsed = Payload.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { date, title, notes, items } = parsed.data;

  // Update workout meta
  run('UPDATE workouts SET date=?, title=?, notes=? WHERE id=?', [date, title||null, notes||null, w.id]);

  // Clear existing children (sets -> group_items -> workout_items)
  const oldItems = all<any>('SELECT id FROM workout_items WHERE workoutId=?', [w.id]);
  for (const oi of oldItems) {
    const gis = all<any>('SELECT id FROM group_items WHERE workoutItemId=?', [oi.id]);
    for (const g of gis) run('DELETE FROM sets WHERE groupItemId=?', [g.id]);
    run('DELETE FROM sets WHERE workoutItemId=?', [oi.id]);
    run('DELETE FROM group_items WHERE workoutItemId=?', [oi.id]);
  }
  run('DELETE FROM workout_items WHERE workoutId=?', [w.id]);

  // Insert new structure
  for (const it of items) {
    run('INSERT INTO workout_items (workoutId,itemType,exerciseId,orderIndex) VALUES (?,?,?,?)',
        [w.id, it.itemType, it.exerciseId ?? null, it.orderIndex ?? 0]);
    const wi = one<any>('SELECT * FROM workout_items WHERE rowid=last_insert_rowid()');

    if (it.itemType === 'exercise') {
      for (const s of it.sets ?? []) {
        run('INSERT INTO sets (workoutItemId,reps,weight,durationSec,distanceM,intervals,workSec,restSec,notes) VALUES (?,?,?,?,?,?,?,?,?)',
          [wi!.id,s.reps??null,s.weight??null,s.durationSec??null,s.distanceM??null,s.intervals??null,s.workSec??null,s.restSec??null,s.notes??null]);
      }
    } else {
      for (const gi of it.groupItems ?? []) {
        run('INSERT INTO group_items (workoutItemId,exerciseId,orderIndex) VALUES (?,?,?)',
            [wi!.id, gi.exerciseId, gi.orderIndex ?? 0]);
        const g = one<any>('SELECT * FROM group_items WHERE rowid=last_insert_rowid()');
        for (const s of gi.sets ?? []) {
          run('INSERT INTO sets (groupItemId,reps,weight,durationSec,distanceM,intervals,workSec,restSec,notes) VALUES (?,?,?,?,?,?,?,?,?)',
            [g!.id,s.reps??null,s.weight??null,s.durationSec??null,s.distanceM??null,s.intervals??null,s.workSec??null,s.restSec??null,s.notes??null]);
        }
      }
    }
  }

  saveDb();
  res.json({ ok:true, workoutId: w.id });
});

// DELETE workout
app.delete('/api/workouts/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const w = one<any>('SELECT * FROM workouts WHERE id=?', [Number(req.params.id)]);
  if (!w || !canEditWorkout(req.user, w)) return res.status(403).json({ error: 'Not found' });

  const its = all<any>('SELECT id FROM workout_items WHERE workoutId=?', [w.id]);
  for (const it of its) {
    const gis = all<any>('SELECT id FROM group_items WHERE workoutItemId=?', [it.id]);
    for (const g of gis) run('DELETE FROM sets WHERE groupItemId=?', [g.id]);
    run('DELETE FROM sets WHERE workoutItemId=?', [it.id]);
    run('DELETE FROM group_items WHERE workoutItemId=?', [it.id]);
  }
  run('DELETE FROM workout_items WHERE workoutId=?', [w.id]);
  run('DELETE FROM workouts WHERE id=?', [w.id]);
  saveDb();
  res.json({ ok:true });
});

app.get('/api/workouts/stats', requireAuth, async (req, res) => {
  await getDb();
  const workouts = all<any>('SELECT * FROM workouts WHERE userId=? ORDER BY date ASC', [req.user.id]);

  const volumeByDay: Record<string, number> = {};
  const cardioDurationByDay: Record<string, number> = {};

  for (const w of workouts) {
    const d = w.date.slice(0,10);
    let dayVol = 0;

    const items = all<any>('SELECT * FROM workout_items WHERE workoutId=?', [w.id]);
    for (const it of items) {
      if (it.exerciseId) {
        const sets = all<any>('SELECT * FROM sets WHERE workoutItemId=?', [it.id]);
        for (const s of sets) {
          if (s.weight && s.reps) dayVol += s.weight * s.reps;
          if (s.durationSec) cardioDurationByDay[d] = (cardioDurationByDay[d]||0) + s.durationSec;
        }
      } else {
        const gis = all<any>('SELECT * FROM group_items WHERE workoutItemId=?',[it.id]);
        for (const g of gis) {
          const sets = all<any>('SELECT * FROM sets WHERE groupItemId=?', [g.id]);
          for (const s of sets) {
            if (s.weight && s.reps) dayVol += s.weight * s.reps;
            if (s.durationSec) cardioDurationByDay[d] = (cardioDurationByDay[d]||0) + s.durationSec;
          }
        }
      }
    }
    volumeByDay[d] = (volumeByDay[d]||0) + dayVol;
  }

  res.json({ volumeByDay, cardioDurationByDay });
});

// Progression for a single exercise by date
// GET /api/workouts/stats/progression?exerciseId=123
app.get('/api/workouts/stats/progression', requireAuth, async (req, res) => {
  await getDb();
  const exerciseId = Number(req.query.exerciseId);
  if (!exerciseId) return res.status(400).json({ error: 'exerciseId required' });

  // detect mode from exercise flags
  const ex = one<any>('SELECT * FROM exercises WHERE id=?', [exerciseId]);
  if (!ex) return res.status(404).json({ error: 'Exercise not found' });

  // Gather all sets for this user's workouts that reference this exercise
  // 1) direct workout_items
  const direct = all<any>(`
    SELECT w.date as date, s.reps, s.weight, s.durationSec
    FROM workouts w
    JOIN workout_items wi ON wi.workoutId = w.id
    LEFT JOIN sets s ON s.workoutItemId = wi.id
    WHERE w.userId=? AND wi.exerciseId=?`, [req.user.id, exerciseId]);

  // 2) inside group_items (superset/circuit)
  const grouped = all<any>(`
    SELECT w.date as date, s.reps, s.weight, s.durationSec
    FROM workouts w
    JOIN workout_items wi ON wi.workoutId = w.id
    JOIN group_items gi ON gi.workoutItemId = wi.id
    LEFT JOIN sets s ON s.groupItemId = gi.id
    WHERE w.userId=? AND gi.exerciseId=?`, [req.user.id, exerciseId]);

  const rows = [...direct, ...grouped];

  // Aggregate by day
  type DayAgg = { date:string; topWeight?:number; topVolume?:number; est1rm?:number; durationSec?:number };
  const byDay = new Map<string, DayAgg>();

  for (const r of rows) {
    if (!r) continue;
    const d = String(r.date).slice(0,10);
    const cur = byDay.get(d) || { date: d };
    // load-based
    if (r.weight != null) {
      const w = Number(r.weight);
      const reps = r.reps != null ? Number(r.reps) : undefined;
      cur.topWeight = Math.max(cur.topWeight ?? 0, w);
      if (reps && reps > 0) {
        const vol = w * reps;
        cur.topVolume = Math.max(cur.topVolume ?? 0, vol);
        const epley = w * (1 + reps / 30);
        cur.est1rm = Math.max(cur.est1rm ?? 0, epley);
      }
    }
    // duration-based
    if (r.durationSec != null) {
      cur.durationSec = (cur.durationSec ?? 0) + Number(r.durationSec);
    }
    byDay.set(d, cur);
  }

  const data = Array.from(byDay.values()).sort((a,b)=>a.date.localeCompare(b.date));

  // Decide mode
  const mode: 'load'|'duration' = ex.hasLoad ? 'load' : (ex.hasDuration ? 'duration' : 'load');

  res.json({ mode, name: ex.name, exerciseId, data });
});

/* ---------- ADMIN ---------- */
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  await getDb();
  res.json(all('SELECT id,email,name,role,createdAt FROM users ORDER BY id ASC'));
});

app.post('/api/admin/promote/:id', requireAuth, requireAdmin, async (req, res) => {
  await getDb();
  run('UPDATE users SET role="ADMIN" WHERE id=?', [Number(req.params.id)]);
  saveDb();
  res.json({ ok: true });
});

app.listen(env.PORT, async () => {
  await getDb();
  console.log(`API listening on :${env.PORT}`);
});

/* ---------- ADMIN: edit / delete users ---------- */
const AdminUpdateUser = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['USER','ADMIN']).optional(),
  password: z.string().min(6).optional()
});

// helpers
function countAdmins(): number {
  const r = one<{ c:number }>('SELECT COUNT(*) as c FROM users WHERE role="ADMIN"');
  return r?.c ?? 0;
}
function isLastAdmin(id:number): boolean {
  // if only one admin and it's this id → last admin
  const admins = all<any>('SELECT id FROM users WHERE role="ADMIN"');
  return admins.length === 1 && admins[0].id === id;
}

// UPDATE user (admin)
app.put('/api/admin/users/:id(\\d+)', requireAuth, requireAdmin, async (req, res) => {
  await getDb();
  const targetId = Number(req.params.id);

  const u = one<any>('SELECT * FROM users WHERE id=?', [targetId]);
  if (!u) return res.status(404).json({ error: 'User not found' });

  const parsed = AdminUpdateUser.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { email, name, role, password } = parsed.data;

  // email uniqueness
  if (email && email !== u.email) {
    const exists = one<any>('SELECT id FROM users WHERE email=?', [email]);
    if (exists) return res.status(409).json({ error: 'Email already in use' });
  }

  // role changes / last-admin protection
  if (role && role !== u.role) {
    if (u.role === 'ADMIN' && role === 'USER' && isLastAdmin(u.id)) {
      return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
  }

  // build dynamic update
  const fields: string[] = [];
  const vals: any[] = [];

  if (email) { fields.push('email=?'); vals.push(email); }
  if (name)  { fields.push('name=?'); vals.push(name); }
  if (role)  { fields.push('role=?'); vals.push(role); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    fields.push('password=?'); vals.push(hash);
  }

  if (fields.length) {
    vals.push(targetId);
    run(`UPDATE users SET ${fields.join(', ')}, updatedAt=datetime('now') WHERE id=?`, vals);
  }

  saveDb();
  res.json({ ok:true });
});

// DELETE user (admin)
app.delete('/api/admin/users/:id(\\d+)', requireAuth, requireAdmin, async (req, res) => {
  await getDb();
  const targetId = Number(req.params.id);

  if (req.user.id === targetId) {
    return res.status(400).json({ error: 'Admins cannot delete themselves' });
  }
  const u = one<any>('SELECT * FROM users WHERE id=?', [targetId]);
  if (!u) return res.status(404).json({ error: 'User not found' });

  if (u.role === 'ADMIN' && isLastAdmin(u.id)) {
    return res.status(400).json({ error: 'Cannot delete the last admin' });
  }

  // Optional: delete their workouts (or you can choose to keep/data‑orphan protect)
  const ws = all<any>('SELECT id FROM workouts WHERE userId=?', [targetId]);
  for (const w of ws) {
    const its = all<any>('SELECT id FROM workout_items WHERE workoutId=?', [w.id]);
    for (const it of its) {
      const gis = all<any>('SELECT id FROM group_items WHERE workoutItemId=?', [it.id]);
      for (const g of gis) run('DELETE FROM sets WHERE groupItemId=?', [g.id]);
      run('DELETE FROM sets WHERE workoutItemId=?', [it.id]);
      run('DELETE FROM group_items WHERE workoutItemId=?', [it.id]);
    }
    run('DELETE FROM workout_items WHERE workoutId=?', [w.id]);
    run('DELETE FROM workouts WHERE id=?', [w.id]);
  }

  run('DELETE FROM users WHERE id=?', [targetId]);
  saveDb();
  res.json({ ok:true });
});

/* ===================== TEMPLATES ===================== */

// List my templates
app.get('/api/templates', requireAuth, async (req, res) => {
  await getDb();
  const rows = all<any>('SELECT id, name, notes, createdAt, updatedAt FROM templates WHERE userId=? ORDER BY updatedAt DESC', [req.user.id]);
  res.json(rows);
});

// Create template
app.post('/api/templates', requireAuth, async (req, res) => {
  await getDb();
  const { name, notes, items } = req.body || {};
  if (!name || !Array.isArray(items)) return res.status(400).json({ error: 'name and items are required' });

  const itemsJson = JSON.stringify(items);
  run(
    'INSERT INTO templates (userId, name, notes, itemsJson, createdAt, updatedAt) VALUES (?,?,?,?,datetime("now"),datetime("now"))',
    [req.user.id, String(name), notes ? String(notes) : null, itemsJson]
  );
  const row = one<any>('SELECT last_insert_rowid() AS id');
  saveDb();
  res.json({ id: row.id });
});

// Read one template (ensure ownership)
app.get('/api/templates/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const t = one<any>('SELECT * FROM templates WHERE id=? AND userId=?', [Number(req.params.id), req.user.id]);
  if (!t) return res.status(404).json({ error: 'Not found' });
  t.items = JSON.parse(t.itemsJson || '[]');
  delete t.itemsJson;
  res.json(t);
});

// Update template
app.put('/api/templates/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const id = Number(req.params.id);
  const t = one<any>('SELECT * FROM templates WHERE id=? AND userId=?', [id, req.user.id]);
  if (!t) return res.status(404).json({ error: 'Not found' });

  const { name, notes, items } = req.body || {};
  const fields: string[] = [];
  const vals: any[] = [];

  if (typeof name === 'string' && name.trim()) { fields.push('name=?'); vals.push(name.trim()); }
  if (typeof notes === 'string' || notes === null) { fields.push('notes=?'); vals.push(notes ?? null); }
  if (Array.isArray(items)) { fields.push('itemsJson=?'); vals.push(JSON.stringify(items)); }

  if (fields.length) {
    run(`UPDATE templates SET ${fields.join(', ')}, updatedAt=datetime('now') WHERE id=?`, [...vals, id]);
    saveDb();
  }
  res.json({ ok: true });
});

// Delete template
app.delete('/api/templates/:id(\\d+)', requireAuth, async (req, res) => {
  await getDb();
  const id = Number(req.params.id);
  const t = one<any>('SELECT id FROM templates WHERE id=? AND userId=?', [id, req.user.id]);
  if (!t) return res.status(404).json({ error: 'Not found' });

  run('DELETE FROM templates WHERE id=?', [id]);
  saveDb();
  res.json({ ok: true });
});

