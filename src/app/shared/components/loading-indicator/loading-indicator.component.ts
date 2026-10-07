import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.component.html',
  styleUrl: './loading-indicator.component.scss',
})
export class LoadingIndicatorComponent {
  readonly label = input('Loading');
  readonly size = input(0.45);
  readonly color = input<string | undefined>(undefined);
  readonly text = input<string | undefined>(undefined);
  readonly description = input<string | undefined>(undefined);
}
