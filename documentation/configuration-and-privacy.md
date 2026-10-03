# Configuration and privacy

## Environment values

Both environment files use a typed configuration. `passwordHash` must be a lowercase SHA-1 digest; no plaintext password is stored. `authExpiryMs: 0` means the local unlocked session does not expire automatically. API endpoints and STUN URLs are centralized there.

Environment values are part of the downloadable JavaScript. Do not add secrets. `ip.intelligenceApiKey` defaults to blank: ipapi.is anonymous responses still supply limited ownership/location information, while some intelligence signals require a key.

## External requests

- M-Lab NDT7: selected server discovery and speed measurement after the user accepts the disclosure.
- ipify: default, IPv4, and IPv6 public-IP checks.
- ipapi.is: optional IP ownership/location/intelligence lookup.
- Configured STUN service: optional WebRTC candidate gathering.
- Configured latency endpoint: optional HTTP/application latency probe.

M-Lab’s policy is linked in the application and should be reviewed before test use. ipapi.is documents that anonymous access is limited and keys should ordinarily be held server-side; a key in an environment file is public.

## Browser limitations

The app cannot perform raw ICMP, inspect TLS cipher/certificate details, read local DNS server settings, inspect router/firewall state, scan ports/LAN devices, obtain MAC addresses, or run a real DNS-leak test. A real DNS-leak test requires controlled authoritative DNS infrastructure that correlates resolver queries. These limits are explicitly shown in the UI.

An mDNS WebRTC candidate means the browser protected/obfuscated a local address; it is not proof of “no leak.” Any VPN/proxy/Tor or IPv6-route conclusion is a provider signal or cautious heuristic, never a definitive security finding.
