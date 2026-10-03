import { Component, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-lock',
  imports: [NgOptimizedImage],
  templateUrl: './lock.component.html',
  styleUrl: './lock.component.scss',
})
export class LockComponent {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly visible = signal(false);
  protected readonly invalid = signal(false);
  protected readonly canUnlock = computed(
    () => Boolean(this.username().trim()) && Boolean(this.password().trim()),
  );
  setUsername(event: Event): void {
    this.username.set((event.target as HTMLInputElement).value);
    this.invalid.set(false);
  }
  setPassword(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
    this.invalid.set(false);
  }
  async unlock(): Promise<void> {
    if (await this.auth.unlock(this.username(), this.password()))
      await this.router.navigateByUrl('/');
    else this.invalid.set(true);
  }
}
