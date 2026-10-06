import { Service, signal } from '@angular/core';
import type {
  IpAddresses,
  IpIntelligence,
  NetNeutralityNetworkContext,
  NetworkCapabilities,
} from '../models/app.models';

@Service()
export class CurrentNetworkContextService {
  readonly current = signal<Readonly<NetNeutralityNetworkContext> | undefined>(undefined);

  updateNetwork(addresses: IpAddresses, capabilities: NetworkCapabilities): void {
    const ipv4 = addresses.ipv4.value?.address;
    const ipv6 = addresses.ipv6.value?.address;
    const previous = this.current();
    const samePublicAddress = Boolean(
      (ipv4 || ipv6) && previous && previous.ipv4 === ipv4 && previous.ipv6 === ipv6,
    );
    this.current.set(
      Object.freeze({
        protocol: addresses.protocol,
        effectiveType: capabilities.effectiveType,
        secureContext: capabilities.secureContext,
        ipv4,
        ipv6,
        ...(samePublicAddress
          ? {
              isp: previous?.isp,
              asn: previous?.asn,
              country: previous?.country,
              region: previous?.region,
              city: previous?.city,
            }
          : {}),
      }),
    );
  }

  clearNetwork(capabilities: NetworkCapabilities): void {
    this.current.set(
      Object.freeze({
        effectiveType: capabilities.effectiveType,
        secureContext: capabilities.secureContext,
      }),
    );
  }

  updateIntelligence(intelligence: IpIntelligence | undefined): void {
    const current = this.current();
    if (!current) return;
    this.current.set(
      Object.freeze({
        ...current,
        isp: intelligence?.companyDetails?.name || intelligence?.organization,
        asn: intelligence?.asnDetails?.asn || intelligence?.asn,
        country: intelligence?.locationDetails?.country || intelligence?.country,
        region: intelligence?.locationDetails?.region || intelligence?.region,
        city: intelligence?.locationDetails?.city || intelligence?.city,
      }),
    );
  }

  snapshot(): Readonly<NetNeutralityNetworkContext> | undefined {
    const current = this.current();
    return current ? Object.freeze({ ...current }) : undefined;
  }
}
