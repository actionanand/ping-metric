import { Component, inject } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HistoryService } from '../../core/services/history.service';

@Component({
  selector: 'app-history',
  imports: [DecimalPipe, DatePipe, RouterLink],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent {
  protected readonly history = inject(HistoryService);
  protected clear(): void {
    if (confirm('Clear all locally stored test history?')) this.history.clear();
  }
}
