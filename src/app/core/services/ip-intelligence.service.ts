import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { IpIntelligence, ServiceResult } from '../models/app.models';

@Service()
export class IpIntelligenceService {
  async lookup(ip: string): Promise<ServiceResult<IpIntelligence>> {
    const url = new URL(environment.ip.intelligenceEndpoint);
    url.searchParams.set('q', ip);
    if (environment.ip.intelligenceApiKey)
      url.searchParams.set('key', environment.ip.intelligenceApiKey);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const data: unknown = await response.json();
      const value = normalize(data);
      return response.ok && value
        ? { state: 'available', value }
        : { state: 'failed', message: 'IP intelligence provider did not return data.' };
    } catch {
      return { state: 'unavailable', message: 'IP intelligence provider could not be reached.' };
    }
  }
}
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
export function normalize(value: unknown): IpIntelligence | undefined {
  const raw = object(value);
  const ip = text(raw['ip']);
  if (!ip) return undefined;
  const location = object(raw['location']);
  const asn = object(raw['asn']);
  const company = object(raw['company']);
  return {
    ip,
    city: text(raw['city']) ?? text(location['city']),
    region: text(raw['region']) ?? text(location['state']),
    country: text(raw['country']) ?? text(location['country']),
    countryCode: text(location['country_code']),
    latitude: number(raw['lat']) ?? number(location['latitude']),
    longitude: number(raw['lon']) ?? number(location['longitude']),
    timezone: text(raw['timezone']) ?? text(location['timezone']),
    asn: text(raw['asn']) ?? (number(asn['asn']) ? `AS${number(asn['asn'])}` : undefined),
    organization: text(raw['company']) ?? text(asn['org']) ?? text(company['name']),
    network: text(asn['route']) ?? text(company['network']),
    security: {
      vpn: bool(raw['is_vpn']),
      proxy: bool(raw['is_proxy']),
      tor: bool(raw['is_tor']),
      datacenter: bool(raw['is_datacenter']),
      mobile: bool(raw['is_mobile']),
      satellite: bool(raw['is_satellite']),
      bogon: bool(raw['is_bogon']),
      crawler: bool(raw['is_crawler']),
    },
  };
}
