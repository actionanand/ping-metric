import { Service } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { IpAddresses, WebRtcCandidate, WebRtcLeakResult } from '../models/app.models';
import { ipFamily } from '../../shared/utils/network.utils';

@Service()
export class WebRtcLeakService {
  async test(known: IpAddresses | undefined): Promise<WebRtcLeakResult> {
    if (!('RTCPeerConnection' in window))
      return {
        state: 'unsupported',
        candidates: [],
        outcome: 'WebRTC is unavailable in this browser.',
      };
    const candidates = new Map<string, WebRtcCandidate>();
    const peer = new RTCPeerConnection({ iceServers: [{ urls: environment.webrtc.stunUrls }] });
    peer.createDataChannel('ping-metric');
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const candidate = classify(event.candidate);
        candidates.set(`${candidate.address}|${candidate.type}|${candidate.protocol}`, candidate);
      }
    };
    try {
      await peer.setLocalDescription(await peer.createOffer());
      await new Promise((resolve) => setTimeout(resolve, 3500));
    } catch {
      return {
        state: 'failed',
        candidates: [],
        outcome: 'WebRTC candidate gathering did not complete.',
      };
    } finally {
      peer.close();
    }
    const values = [...candidates.values()];
    const publicAddresses = values
      .filter((candidate) => !candidate.isMdns && candidate.type === 'srflx')
      .map((candidate) => candidate.address);
    const knownAddresses = [known?.ipv4.value?.address, known?.ipv6.value?.address].filter(
      (value): value is string => Boolean(value),
    );
    const extra = publicAddresses.filter((address) => !knownAddresses.includes(address));
    const outcome = values.some((candidate) => candidate.isMdns)
      ? 'Local address protected/obfuscated by browser.'
      : extra.length
        ? 'Possible WebRTC IP exposure: an additional public address was observed.'
        : publicAddresses.length
          ? 'No additional public address observed.'
          : 'Test inconclusive.';
    return { state: 'available', candidates: values, outcome };
  }
}
export function classify(candidate: RTCIceCandidate): WebRtcCandidate {
  const fallback = candidate.candidate.split(' ');
  const address = candidate.address || fallback[4] || 'Unknown';
  return {
    address,
    family: ipFamily(address),
    type: candidate.type || fallback[7] || 'unknown',
    protocol: candidate.protocol || fallback[2]?.toUpperCase(),
    isMdns: address.endsWith('.local'),
  };
}
