import { describe, expect, it } from 'vitest';
import { normalize } from './ip-intelligence.service';

describe('ipapi.is normalization', () => {
  it('maps documented nested response fields without leaking raw provider data', () => {
    expect(
      normalize({
        ip: '203.0.113.1',
        is_vpn: true,
        company: { name: 'Example ISP', network: '203.0.113.0/24' },
        asn: { asn: 64500, org: 'Example ASN', route: '203.0.113.0/24' },
        location: { city: 'Example City', country: 'Example', latitude: 1, longitude: 2 },
      }),
    ).toMatchObject({
      ip: '203.0.113.1',
      asn: 'AS64500',
      organization: 'Example ASN',
      security: { vpn: true },
    });
  });
});
