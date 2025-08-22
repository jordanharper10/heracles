-- Users
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exercises
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL, -- weights|cardio|hiit|plyometric|mobility
  muscleGroup TEXT,
  equipment TEXT,
  youtubeUrl TEXT,
  hasLoad INTEGER NOT NULL DEFAULT 0,
  hasReps INTEGER NOT NULL DEFAULT 0,
  hasDuration INTEGER NOT NULL DEFAULT 0,
  hasIntervals INTEGER NOT NULL DEFAULT 0,
  createdById INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(createdById) REFERENCES users(id)
);

-- Workouts
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  date TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(userId) REFERENCES users(id)
);

-- Workout items
CREATE TABLE IF NOT EXISTS workout_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workoutId INTEGER NOT NULL,
  itemType TEXT NOT NULL, -- exercise|superset|circuit
  exerciseId INTEGER,
  orderIndex INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(workoutId) REFERENCES workouts(id),
  FOREIGN KEY(exerciseId) REFERENCES exercises(id)
);

-- Group items
CREATE TABLE IF NOT EXISTS group_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workoutItemId INTEGER NOT NULL,
  exerciseId INTEGER NOT NULL,
  orderIndex INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(workoutItemId) REFERENCES workout_items(id),
  FOREIGN KEY(exerciseId) REFERENCES exercises(id)
);

-- Sets
CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workoutItemId INTEGER,
  groupItemId INTEGER,
  reps INTEGER,
  weight REAL,
  durationSec INTEGER,
  distanceM INTEGER,
  intervals INTEGER,
  workSec INTEGER,
  restSec INTEGER,
  notes TEXT,
  FOREIGN KEY(workoutItemId) REFERENCES workout_items(id),
  FOREIGN KEY(groupItemId) REFERENCES group_items(id)
);

--- Templates
CREATE TABLE IF NOT EXISTS templates (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  userId    INTEGER NOT NULL,
  name      TEXT    NOT NULL,
  notes     TEXT,
  itemsJson TEXT    NOT NULL,
  createdAt TEXT    DEFAULT (datetime('now')),
  updatedAt TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY(userId) REFERENCES users(id)
);
