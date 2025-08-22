import fs from 'fs';
import path from 'path';
import { getDb, run, saveDb, one } from './sql.js';
import bcrypt from 'bcryptjs';

async function migrate() {
  await getDb();
  const sql = fs.readFileSync(path.resolve('src/db/schema.sql'), 'utf8');
  sql.split(/;\s*$/m).forEach(stmt => {
    const s = stmt.trim();
    if (s) run(s);
  });

  // Seed exercises if empty
  const count = one<{ c:number }>('SELECT COUNT(*) as c FROM exercises')?.c ?? 0;
  if (count === 0) {
    const base = [
      ['Back Squat','weights','legs',null,null,null,1,1,0,0],
      ['Bench Press','weights','chest',null,null,null,1,1,0,0],
      ['Deadlift','weights','posterior',null,null,null,1,1,0,0],
      ['Overhead Press','weights','shoulders',null,null,null,1,1,0,0],
      ['Barbell Row','weights','back',null,null,null,1,1,0,0],
      ['5k Run','cardio',null,null,null,null,0,0,1,0],
      ['Assault Bike Intervals','hiit',null,null,null,null,0,0,0,1],
      ['Box Jump','plyometric',null,null,null,null,0,1,0,0],
      ['Dynamic Hip Mobility','mobility',null,null,'https://www.youtube.com/watch?v=dQw4w9WgXcQ',null,0,0,1,0]
    ];
    for (const e of base) {
      run(
        `INSERT OR IGNORE INTO exercises
        (name,category,muscleGroup,equipment,youtubeUrl,createdById,hasLoad,hasReps,hasDuration,hasIntervals)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        e as any
      );
    }
  }

  const userCount = one<{ c:number }>('SELECT COUNT(*) as c FROM users')?.c ?? 0;
  if (userCount === 0) {
    const email = process.env.ADMIN_EMAIL || 'admin@local';
    const name  = process.env.ADMIN_NAME  || 'Admin';
    const pass  = process.env.ADMIN_PASSWORD || 'admin123'; // change after first login
    const hash  = await bcrypt.hash(pass, 10);
    run('INSERT INTO users (email,name,password,role) VALUES (?,?,?,?)',
        [email, name, hash, 'ADMIN']);
    console.log(`Seeded admin user: ${email} / ${pass}`);
  }

  saveDb();
  console.log('Migration complete.');
}
migrate();

