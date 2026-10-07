import { Component, input } from '@angular/core';

@Component({
  selector: 'app-server-discovery-indicator',
  templateUrl: './server-discovery-indicator.component.html',
  styleUrl: './server-discovery-indicator.component.scss',
})
export class ServerDiscoveryIndicatorComponent {
  readonly label = input('Finding a measurement server');
}
