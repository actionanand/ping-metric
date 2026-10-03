import type { AppEnvironment } from '../app/core/models/app.models';

// Environment files are public client configuration, not secret storage.
export const environment: AppEnvironment = {
  production: false,
  passwordHash: '8e7152d0eb52c340579f2d70a28eaf1a2c5ba1c5', // password@123 is the dev password
  authStorageKey: 'ping-metric.auth.v1',
  authExpiryMs: 0,
  mlab: { clientName: 'ping-metric', clientVersion: '1.0.0-dev' },
  ip: {
    ipv4Endpoint: 'https://api.ipify.org?format=json',
    ipv6Endpoint: 'https://api6.ipify.org?format=json',
    universalEndpoint: 'https://api64.ipify.org?format=json',
    intelligenceEndpoint: 'https://api.ipapi.is',
    intelligenceApiKey: '',
  },
  latency: { probeUrl: 'https://www.google.com/generate_204', attempts: 5, timeoutMs: 5000 },
  webrtc: { stunUrls: ['stun:stun.l.google.com:19302'] },
};
