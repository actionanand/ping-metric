import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { IpAddress, IpAddresses, ServiceResult } from '../models/app.models';
import { ipFamily } from '../../shared/utils/network.utils';

@Service()
export class IpAddressService {
  async lookupAll(): Promise<IpAddresses> {
    const [defaultIp, ipv4, ipv6] = await Promise.all([
      this.lookup(environment.ip.universalEndpoint, 'default'),
      this.lookup(environment.ip.ipv4Endpoint, 'ipv4'),
      this.lookup(environment.ip.ipv6Endpoint, 'ipv6'),
    ]);
    const protocol =
      ipv4.state === 'available' && ipv6.state === 'available'
        ? 'Dual stack'
        : ipv4.state === 'available'
          ? 'IPv4 only'
          : ipv6.state === 'available'
            ? 'IPv6 only'
            : 'Unknown';
    return { default: defaultIp, ipv4, ipv6, protocol };
  }
  private async lookup(
    url: string,
    source: IpAddress['source'],
  ): Promise<ServiceResult<IpAddress>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      const payload: unknown = await response.json();
      const address = readIp(payload);
      if (!response.ok || !address)
        return { state: 'failed', message: 'IP service returned an invalid response.' };
      const family = ipFamily(address);
      return family === 'unknown'
        ? { state: 'failed', message: 'IP service returned an invalid address.' }
        : { state: 'available', value: { address, family, source } };
    } catch (error: unknown) {
      return {
        state:
          error instanceof DOMException && error.name === 'AbortError'
            ? 'timed-out'
            : 'unavailable',
        message:
          source === 'ipv6'
            ? 'IPv6 is unavailable or the endpoint could not be reached.'
            : 'IP service could not be reached.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
function readIp(payload: unknown): string | undefined {
  return typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { ip?: unknown }).ip === 'string'
    ? (payload as { ip: string }).ip.trim()
    : undefined;
}
