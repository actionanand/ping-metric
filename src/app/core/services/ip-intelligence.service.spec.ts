import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { IpIntelligenceService, normalize } from './ip-intelligence.service';

vi.mock('../../../environments/environment', () => ({
  environment: {
    ip: { intelligenceEndpoint: 'https://api.ipapi.is', intelligenceApiKey: '' },
  },
}));

describe('IP intelligence lookup', () => {
  const ip = '203.0.113.1';
  const fetchMock = vi.fn<typeof fetch>();
  const service = new IpIntelligenceService();

  beforeEach(() => {
    environment.ip.intelligenceApiKey = '';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function response(status: number, data: unknown): Response {
    return new Response(JSON.stringify(data), { status });
  }

  function requestedUrl(index: number): URL {
    return new URL(String(fetchMock.mock.calls[index][0]));
  }

  it('makes one anonymous request when no key is configured', async () => {
    fetchMock.mockResolvedValueOnce(response(200, { ip }));

    await expect(service.lookup(ip)).resolves.toMatchObject({
      state: 'available',
      providerMode: 'anonymous',
      value: { ip },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0).searchParams.get('q')).toBe(ip);
    expect(requestedUrl(0).searchParams.has('key')).toBe(false);
    expect(fetchMock.mock.calls[0][1]).toEqual({ cache: 'no-store' });
  });

  it('uses the full successful keyed response without retrying', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    const data = {
      ip,
      city: 'Example City',
      region: 'Example State',
      country: 'Example Country',
      lat: 1,
      lon: 2,
      timezone: 'UTC',
      asn: { asn: 64500, org: 'Example ASN', route: '203.0.113.0/24' },
      location: { country_code: 'EX' },
      is_vpn: true,
      is_proxy: false,
      is_tor: false,
      is_datacenter: true,
    };
    fetchMock.mockResolvedValueOnce(response(200, data));

    await expect(service.lookup(ip)).resolves.toEqual({
      state: 'available',
      providerMode: 'keyed',
      value: normalize(data),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0).searchParams.get('key')).toBe('test-public-key');
  });

  it('retries a keyed 429 once anonymously and returns basic fields without fabricating flags', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 })).mockResolvedValueOnce(
      response(200, {
        ip,
        location: {
          city: 'Example City',
          state: 'Example State',
          country: 'Example Country',
          country_code: 'EX',
          latitude: 1,
          longitude: 2,
          timezone: 'UTC',
        },
        company: { name: 'Example ISP', network: '203.0.113.0/24' },
        asn: { asn: 64500 },
      }),
    );

    const result = await service.lookup(ip);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0).searchParams.get('key')).toBe('test-public-key');
    const expectedAnonymousUrl = requestedUrl(0);
    expectedAnonymousUrl.searchParams.delete('key');
    expect(requestedUrl(1).href).toBe(expectedAnonymousUrl.href);
    expect(fetchMock.mock.calls[1][1]).toEqual({ cache: 'no-store' });
    expect(result).toMatchObject({
      state: 'available',
      providerMode: 'anonymous-fallback',
      value: {
        ip,
        city: 'Example City',
        region: 'Example State',
        country: 'Example Country',
        countryCode: 'EX',
        latitude: 1,
        longitude: 2,
        timezone: 'UTC',
        asn: 'AS64500',
        organization: 'Example ISP',
        network: '203.0.113.0/24',
      },
    });
    expect(Object.values(result.value?.security ?? {})).toHaveLength(8);
    expect(Object.values(result.value?.security ?? {}).every((flag) => flag === undefined)).toBe(
      true,
    );
    expect(result.message).toBeUndefined();
  });

  it('does not retry a keyed 500', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    fetchMock.mockResolvedValueOnce(response(500, { error: 'Provider error' }));

    await expect(service.lookup(ip)).resolves.toEqual({
      state: 'failed',
      message: 'IP intelligence provider did not return data.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never reports quota fallback for an anonymous failure', async () => {
    fetchMock.mockResolvedValueOnce(response(500, { error: 'Provider error' }));
    const result = await service.lookup(ip);
    expect(result.providerMode).toBeUndefined();
    expect(result.message).not.toContain('quota');
  });

  it('does not retry an anonymous 429', async () => {
    fetchMock.mockResolvedValueOnce(response(429, { error: 'Quota exceeded' }));

    await expect(service.lookup(ip)).resolves.toMatchObject({ state: 'failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500])(
    'returns a clean failure after fallback HTTP %s without further retries',
    async (status) => {
      environment.ip.intelligenceApiKey = 'test-public-key';
      fetchMock
        .mockResolvedValueOnce(response(429, {}))
        .mockResolvedValueOnce(response(status, { error: 'test-public-key' }));

      await expect(service.lookup(ip)).resolves.toEqual({
        state: 'failed',
        message: 'IP intelligence provider did not return data.',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('returns unavailable if the fallback cannot be reached without exposing the key', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    fetchMock
      .mockResolvedValueOnce(response(429, {}))
      .mockRejectedValueOnce(new Error('test-public-key'));

    await expect(service.lookup(ip)).resolves.toEqual({
      state: 'unavailable',
      message: 'IP intelligence provider could not be reached.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry keyed network errors', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(service.lookup(ip)).resolves.toMatchObject({ state: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns failed when the fallback response has no IP', async () => {
    environment.ip.intelligenceApiKey = 'test-public-key';
    fetchMock.mockResolvedValueOnce(response(429, {})).mockResolvedValueOnce(response(200, {}));

    await expect(service.lookup(ip)).resolves.toMatchObject({ state: 'failed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

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

  it('preserves three-state security flags and keyed detail fields', () => {
    const normalized = normalize({
      ip,
      rir: 'ARIN',
      is_vpn: false,
      is_proxy: true,
      is_anycast: true,
      is_crawler: null,
      vpn: { name: 'Example VPN' },
      datacenter: { datacenter: 'Example DC' },
      egress_service: { name: 'Privacy relay' },
    });
    expect(normalized).toMatchObject({
      rir: 'ARIN',
      vpnProvider: 'Example VPN',
      datacenterProvider: 'Example DC',
      egressService: 'Privacy relay',
      security: { vpn: false, proxy: true, anycast: true, crawler: undefined, tor: undefined },
    });
  });

  it('normalizes real keyed company, ASN, location, and network contact objects', () => {
    const result = normalize({
      ip,
      company: {
        name: 'Example ISP',
        abuser_score: '0 (Very Low)',
        domain: 'example.test',
        type: 'isp',
        network: '203.0.113.0/24',
        netname: 'EXAMPLE-NET',
      },
      abuse: {
        name: 'Example Abuse',
        address: '1 Example Road',
        email: 'abuse@example.test',
        phone: '+1 555 0100',
      },
      asn: {
        asn: 64500,
        abuser_score: '0 (Very Low)',
        route: '203.0.113.0/24',
        descr: 'Example ASN',
        country: 'EX',
        active: true,
        org: 'Example ISP',
        domain: 'example.test',
        abuse: 'abuse@example.test',
        type: 'isp',
        updated: '2026-01-01',
        rir: 'ARIN',
      },
      location: {
        country: 'Example Country',
        country_code: 'EX',
        state: 'Example State',
        city: 'Example City',
        latitude: 1,
        longitude: 2,
        zip: '12345',
        timezone: 'UTC',
        local_time: '2026-01-01T00:00:00+00:00',
        utcoffset: '+00:00',
        accuracy: 'HIGH',
        calling_code: '1',
        currency_code: 'USD',
        continent: 'NA',
      },
    });
    expect(result).toMatchObject({
      companyDetails: { name: 'Example ISP', netname: 'EXAMPLE-NET', abuserScore: '0 (Very Low)' },
      asnDetails: { asn: 'AS64500', description: 'Example ASN', active: true, rir: 'ARIN' },
      locationDetails: {
        postalCode: '12345',
        utcOffset: '+00:00',
        accuracy: 'HIGH',
        callingCode: '1',
        currencyCode: 'USD',
      },
      abuseDetails: { email: 'abuse@example.test', phone: '+1 555 0100' },
    });
  });

  it('omits optional detail objects when the provider did not send them', () => {
    const result = normalize({ ip, is_vpn: false, is_datacenter: false });
    expect(result?.vpnProvider).toBeUndefined();
    expect(result?.datacenterProvider).toBeUndefined();
    expect(result?.egressService).toBeUndefined();
    expect(result?.security.vpn).toBe(false);
    expect(result?.security.proxy).toBeUndefined();
  });
});
