const AUTH_KEY = 'scholarmind-auth';

export interface AuthState {
  userId: string;
  username: string;
  avatarUrl?: string;
  token: string;
}

export function getAuth(): AuthState | null {
  try {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? (JSON.parse(saved) as AuthState) : null;
  } catch {
    return null;
  }
}

export function setAuth(auth: AuthState): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  } catch {}
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {}
}

export function isLoggedIn(): boolean {
  return getAuth() !== null;
}

export function generateGuestId(): string {
  return `guest-${Math.random().toString(36).slice(2, 10)}`;
}
