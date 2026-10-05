import type { AppEnvironment } from '../app/core/models/app.models';

// These values are compiled into the browser bundle. Never place a server secret here.
export const environment: AppEnvironment = {
  production: true,
  passwordHash: 'PASSWORD_HASH_PLACEHOLDER', // To be replaced during build with actual hash
  authStorageKey: 'ping-metric.auth.v1',
  authExpiryMs: 0,
  mlab: { clientName: 'ping-metric', clientVersion: '1.0.0' },
  ip: {
    ipv4Endpoint: 'https://api.ipify.org?format=json',
    ipv6Endpoint: 'https://api6.ipify.org?format=json',
    universalEndpoint: 'https://api64.ipify.org?format=json',
    intelligenceEndpoint: 'https://api.ipapi.is',
    // Only use a key explicitly intended for public browser clients.
    intelligenceApiKey: 'IPAPI_IS_PLACEHOLDER',
  },
  latency: {
    probeUrl: 'https://speed.cloudflare.com/__down?bytes=0',
    attempts: 5,
    timeoutMs: 5000,
  },
  webrtc: { stunUrls: ['stun:stun.l.google.com:19302'] },
};
