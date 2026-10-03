import { Service, signal } from '@angular/core';
import type { NetworkCapabilities } from '../models/app.models';

interface NetworkConnection extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}
@Service()
export class NetworkInfoService {
  readonly info = signal<NetworkCapabilities>(this.read());
  constructor() {
    window.addEventListener('online', () => this.info.set(this.read()));
    window.addEventListener('offline', () => this.info.set(this.read()));
  }
  refresh(): void {
    this.info.set(this.read());
  }
  private read(): NetworkCapabilities {
    const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
    return {
      online: navigator.onLine,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      secureContext: window.isSecureContext,
      webCrypto: Boolean(window.crypto?.subtle),
      webRtc: 'RTCPeerConnection' in window,
      networkInformation: Boolean(connection),
    };
  }
}
