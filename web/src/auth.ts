// web/src/auth.ts
export type User = { id: number; name: string; email: string; role: 'USER' | 'ADMIN' };

const KEY_TOKEN = 'token';
const KEY_USER  = 'user';

export function getToken(): string | null {
  return localStorage.getItem(KEY_TOKEN);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(KEY_USER);
  try { return raw ? JSON.parse(raw) as User : null; } catch { return null; }
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function setAuth(token: string, user: User) {
  localStorage.setItem(KEY_TOKEN, token);
  localStorage.setItem(KEY_USER, JSON.stringify(user));
  if (user?.role) localStorage.setItem('role', user.role); // if you use this elsewhere
}

export function clearAuth() {
  localStorage.removeItem(KEY_TOKEN);
  localStorage.removeItem(KEY_USER);
  localStorage.removeItem('role');
}

