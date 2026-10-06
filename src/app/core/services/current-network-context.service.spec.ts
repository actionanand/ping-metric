import { describe, expect, it } from 'vitest';
import type { IpAddresses, IpIntelligence, NetworkCapabilities } from '../models/app.models';
import { CurrentNetworkContextService } from './current-network-context.service';

const capabilities: NetworkCapabilities = {
  online: true,
  effectiveType: '4g',
  secureContext: true,
  webCrypto: true,
  webRtc: true,
  networkInformation: true,
};

function addresses(ipv4: string, protocol: IpAddresses['protocol']): IpAddresses {
  return {
    default: { state: 'available', value: { address: ipv4, family: 'ipv4', source: 'default' } },
    ipv4: { state: 'available', value: { address: ipv4, family: 'ipv4', source: 'ipv4' } },
    ipv6: { state: 'unavailable' },
    protocol,
  };
}

function intelligence(isp: string, city: string): IpIntelligence {
  return {
    ip: '198.51.100.1',
    organization: isp,
    city,
    security: {
      vpn: undefined,
      proxy: undefined,
      tor: undefined,
      datacenter: undefined,
      abuser: undefined,
      mobile: undefined,
      satellite: undefined,
      anycast: undefined,
      bogon: undefined,
      crawler: undefined,
    },
  };
}

describe('CurrentNetworkContextService', () => {
  it('updates known context and preserves frozen snapshots when the network changes', () => {
    const service = new CurrentNetworkContextService();
    service.updateNetwork(addresses('198.51.100.1', 'IPv4 only'), capabilities);
    service.updateIntelligence(intelligence('Network A ISP', 'Network A City'));
    const networkA = service.snapshot();

    service.updateNetwork(addresses('203.0.113.2', 'Dual stack'), {
      ...capabilities,
      effectiveType: '3g',
    });
    service.updateIntelligence(intelligence('Network B ISP', 'Network B City'));

    expect(networkA).toMatchObject({
      protocol: 'IPv4 only',
      effectiveType: '4g',
      isp: 'Network A ISP',
      city: 'Network A City',
      ipv4: '198.51.100.1',
    });
    expect(Object.isFrozen(networkA)).toBe(true);
    expect(service.snapshot()).toMatchObject({
      protocol: 'Dual stack',
      effectiveType: '3g',
      isp: 'Network B ISP',
      city: 'Network B City',
      ipv4: '203.0.113.2',
    });
  });

  it('clears IPAPI fields without clearing IP/browser data when intelligence is disabled', () => {
    const service = new CurrentNetworkContextService();
    service.updateNetwork(addresses('198.51.100.1', 'IPv4 only'), capabilities);
    service.updateIntelligence(intelligence('Network A ISP', 'Network A City'));

    service.updateIntelligence(undefined);

    expect(service.snapshot()).toEqual({
      protocol: 'IPv4 only',
      effectiveType: '4g',
      secureContext: true,
      ipv4: '198.51.100.1',
      ipv6: undefined,
      isp: undefined,
      asn: undefined,
      country: undefined,
      region: undefined,
      city: undefined,
    });
  });
});
