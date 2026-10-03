# PingMetric

PingMetric is a mobile-first, client-only Internet speed, latency, IP, and browser privacy diagnostics app for GitHub Pages. It has no backend, user accounts, telemetry, advertising, or server database.

## Features

- M-Lab NDT7 end-to-end download and upload measurement with an explicit first-use data-policy disclosure.
- HTTP/application latency samples, median, jitter, TCP RTT information where NDT7 provides it, and a TCP retransmission estimate (not packet loss).
- Independently refreshed public IPv4, IPv6, and default IP checks; optional ipapi.is ownership, location, ASN, and provider-reported network intelligence.
- Bounded WebRTC ICE-candidate inspection, browser capability reporting, and clear browser-only limitations.
- SHA-1 Web Crypto client-side access gate, local history, and System/Light/Dark appearance settings.

## Install and run

The only required runtime dependency is already declared, but install it if your checkout does not have it:

```bash
npm i @m-lab/ndt7
npm run develop
```

Run checks and builds when ready:

```bash
npm run lint
npm test
npm run build
npm run build:gh
npm run copy-error-page
```

`build:gh` preserves deployment below `/ping-metric/`. The GitHub Actions workflow copies `index.html` to `404.html` after the GitHub Pages build for route fallback.

## Environment configuration

Edit `src/environments/environment.ts` (and the development variant as needed):

- `passwordHash`: lowercase SHA-1 digest of the desired password. Keep `PASSWORD_HASH_PLACEHOLDER` until configured; the app will show a configuration message and remain locked.
- `authStorageKey` and `authExpiryMs`: browser session storage key and optional expiry. `0` means no automatic expiry.
- `ip.intelligenceApiKey`: optional ipapi.is key. Leave blank for anonymous location/ownership fields.
- `latency.probeUrl`: CORS-accessible endpoint used for HTTP/application timings.

Angular environment values are compiled into public JavaScript. Do not put a private/server secret, paid private credential, or plaintext password in them. ipapi.is itself recommends keeping keys server-side; only use an intentionally browser-safe key if you accept that exposure.

To create a hash in a browser console:

```js
crypto.subtle
  .digest('SHA-1', new TextEncoder().encode('your-password'))
  .then((x) => [...new Uint8Array(x)].map((b) => b.toString(16).padStart(2, '0')).join(''));
```

## Privacy and limitations

The lock screen is a casual client-side access gate, not server-side authentication: the complete static application is delivered to the browser. PingMetric stores its own auth state, settings, consent, and normalized completed tests only in local browser storage. It does not retain passwords, M-Lab access tokens, candidate ports, or high-frequency raw samples.

M-Lab receives measurement information needed to operate NDT7, including public-IP-related measurement data; the app shows its disclosure before the first test. IP lookups use ipify and optionally ipapi.is. WebRTC probing contacts the configured STUN service. See the in-app About page and `documentation/` for details.

A browser cannot perform ICMP ping, read negotiated TLS details, identify a local DNS resolver, scan a LAN/router, obtain MAC addresses, or run a trustworthy DNS-leak test without dedicated infrastructure. PingMetric labels those limitations rather than fabricating results. IP location is approximate, and VPN/proxy/Tor classifications are provider-reported, fallible signals.

## Architecture

`src/app/core` holds typed models and single-purpose services. Lazy feature routes in `features/` render lock, dashboard, history, settings, and About views. `shared/utils/network.utils.ts` contains pure, testable conversion, validation, parsing, latency, and retransmission helpers. NDT7 worker assets are copied from the installed package during Angular builds.
