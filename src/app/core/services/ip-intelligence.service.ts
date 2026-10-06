import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { IpIntelligence, IpIntelligenceResult } from '../models/app.models';

@Service()
export class IpIntelligenceService {
  async lookup(ip: string): Promise<IpIntelligenceResult> {
    const url = new URL(environment.ip.intelligenceEndpoint);
    url.searchParams.set('q', ip);
    if (environment.ip.intelligenceApiKey)
      url.searchParams.set('key', environment.ip.intelligenceApiKey);
    const keyed = Boolean(environment.ip.intelligenceApiKey);
    try {
      let response = await fetch(url, { cache: 'no-store' });
      let providerMode: IpIntelligenceResult['providerMode'] = keyed ? 'keyed' : 'anonymous';
      if (response.status === 429 && keyed) {
        const anonymousUrl = new URL(url);
        anonymousUrl.searchParams.delete('key');
        response = await fetch(anonymousUrl, { cache: 'no-store' });
        providerMode = 'anonymous-fallback';
      }
      const data: unknown = await response.json();
      const value = normalize(data);
      return response.ok && value
        ? { state: 'available', value, providerMode }
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
function details<T extends object>(value: T): T | undefined {
  return Object.values(value).some((field) => field !== undefined) ? value : undefined;
}
export function normalize(value: unknown): IpIntelligence | undefined {
  const raw = object(value);
  const ip = text(raw['ip']);
  if (!ip) return undefined;
  const location = object(raw['location']);
  const asn = object(raw['asn']);
  const company = object(raw['company']);
  const abuse = object(raw['abuse']);
  const vpn = object(raw['vpn']);
  const datacenter = object(raw['datacenter']);
  const egress = object(raw['egress_service']);
  const asnNumber = number(asn['asn']);
  return {
    ip,
    city: text(raw['city']) ?? text(location['city']),
    region: text(raw['region']) ?? text(location['state']),
    country: text(raw['country']) ?? text(location['country']),
    countryCode: text(location['country_code']),
    latitude: number(raw['lat']) ?? number(location['latitude']),
    longitude: number(raw['lon']) ?? number(location['longitude']),
    timezone: text(raw['timezone']) ?? text(location['timezone']),
    asn: text(raw['asn']) ?? (asnNumber ? `AS${asnNumber}` : undefined),
    organization: text(raw['company']) ?? text(asn['org']) ?? text(company['name']),
    network: text(asn['route']) ?? text(company['network']),
    rir: text(raw['rir']) ?? text(asn['rir']),
    companyType: text(company['type']) ?? text(asn['type']),
    vpnProvider: text(vpn['name']) ?? text(vpn['provider']),
    datacenterProvider: text(datacenter['datacenter']) ?? text(datacenter['name']),
    egressService: text(raw['egress_service']) ?? text(egress['name']) ?? text(egress['service']),
    companyDetails: details({
      name: text(company['name']),
      domain: text(company['domain']),
      type: text(company['type']),
      network: text(company['network']),
      netname: text(company['netname']),
      abuserScore: text(company['abuser_score']),
    }),
    asnDetails: details({
      asn: asnNumber ? `AS${asnNumber}` : text(raw['asn']),
      route: text(asn['route']),
      description: text(asn['descr']),
      country: text(asn['country']),
      active: bool(asn['active']),
      organization: text(asn['org']),
      domain: text(asn['domain']),
      abuseEmail: text(asn['abuse']),
      type: text(asn['type']),
      updated: text(asn['updated']),
      rir: text(asn['rir']),
      abuserScore: text(asn['abuser_score']),
    }),
    locationDetails: details({
      city: text(location['city']) ?? text(raw['city']),
      region: text(location['state']) ?? text(raw['region']),
      country: text(location['country']) ?? text(raw['country']),
      countryCode: text(location['country_code']),
      postalCode: text(location['zip']),
      timezone: text(location['timezone']) ?? text(raw['timezone']),
      localTime: text(location['local_time']),
      utcOffset: text(location['utcoffset']),
      accuracy: text(location['accuracy']),
      latitude: number(location['latitude']) ?? number(raw['lat']),
      longitude: number(location['longitude']) ?? number(raw['lon']),
      callingCode: text(location['calling_code']),
      currencyCode: text(location['currency_code']),
      continent: text(location['continent']),
    }),
    abuseDetails: details({
      name: text(abuse['name']),
      address: text(abuse['address']),
      email: text(abuse['email']),
      phone: text(abuse['phone']),
    }),
    security: {
      vpn: bool(raw['is_vpn']),
      proxy: bool(raw['is_proxy']),
      tor: bool(raw['is_tor']),
      datacenter: bool(raw['is_datacenter']),
      abuser: bool(raw['is_abuser']),
      mobile: bool(raw['is_mobile']),
      satellite: bool(raw['is_satellite']),
      anycast: bool(raw['is_anycast']),
      bogon: bool(raw['is_bogon']),
      crawler: bool(raw['is_crawler']),
    },
  };
}
