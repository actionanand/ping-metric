import { Component, input } from '@angular/core';

@Component({
  selector: 'app-chart-loading-placeholder',
  templateUrl: './chart-loading-placeholder.component.html',
  styleUrl: './chart-loading-placeholder.component.scss',
})
export class ChartLoadingPlaceholderComponent {
  readonly label = input('Loading chart');
}
