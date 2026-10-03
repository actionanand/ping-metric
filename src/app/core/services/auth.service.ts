import { Service, computed, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

interface AuthSession {
  unlockedAt: number;
  accountName: string;
}

@Service()
export class AuthService {
  private readonly session = signal<AuthSession | null>(this.readSession());
  readonly configured = computed(
    () => Boolean(environment.passwordHash) && !environment.passwordHash.includes('PLACEHOLDER'),
  );
  readonly unlocked = computed(() => this.configured() && this.isValid(this.session()));

  async unlock(accountName: string, password: string): Promise<boolean> {
    if (!this.configured() || !accountName.trim()) return false;
    const hash = await sha1(password);
    if (hash !== environment.passwordHash.toLowerCase()) return false;
    // The account name supports a familiar login flow. Never persist the password.
    const session = { unlockedAt: Date.now(), accountName: accountName.trim() };
    localStorage.setItem(environment.authStorageKey, JSON.stringify(session));
    this.session.set(session);
    return true;
  }
  lock(): void {
    localStorage.removeItem(environment.authStorageKey);
    this.session.set(null);
  }
  private readSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(environment.authStorageKey);
      return raw ? (JSON.parse(raw) as AuthSession) : null;
    } catch {
      return null;
    }
  }
  private isValid(session: AuthSession | null): boolean {
    if (!session) return false;
    return (
      environment.authExpiryMs === 0 || Date.now() - session.unlockedAt < environment.authExpiryMs
    );
  }
}

export async function sha1(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
