import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_TERMS, searchGuideTerms } from './network-guide.terms';
@Component({
  selector: 'app-network-guide',
  imports: [RouterLink],
  templateUrl: './network-guide.component.html',
  styleUrl: './network-guide.component.scss',
})
export class NetworkGuideComponent {
  protected readonly terms = GUIDE_TERMS;
  protected readonly query = signal('');
  protected readonly matches = computed(() => searchGuideTerms(this.query()));

  setQuery(event: Event): void {
    this.query.set((event.currentTarget as HTMLInputElement).value);
  }
}
