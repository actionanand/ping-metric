export interface GuideTerm {
  readonly term: string;
  readonly title: string;
  readonly anchor: string;
  readonly aliases: readonly string[];
  readonly description: string;
}

export const GUIDE_TERMS: readonly GuideTerm[] = [
  {
    term: 'ASN',
    title: 'Autonomous System Number',
    anchor: 'asn',
    aliases: ['autonomous system', 'routing network'],
    description: 'Identifies a network operator that announces Internet routes.',
  },
  {
    term: 'ISP',
    title: 'Internet Service Provider',
    anchor: 'isp',
    aliases: ['internet provider', 'provider'],
    description: 'The organization that provides Internet connectivity.',
  },
  {
    term: 'IP location',
    title: 'Approximate IP-based location',
    anchor: 'ip-location',
    aliases: ['city', 'region', 'country', 'not gps'],
    description: 'A network registration estimate, not a GPS position.',
  },
  {
    term: 'IPv4',
    title: 'Internet Protocol version 4',
    anchor: 'ipv4',
    aliases: ['ip version 4'],
    description: 'The widely used 32-bit Internet address format.',
  },
  {
    term: 'IPv6',
    title: 'Internet Protocol version 6',
    anchor: 'ipv6',
    aliases: ['ip version 6'],
    description: 'The newer 128-bit Internet address format.',
  },
  {
    term: 'NAT',
    title: 'Network Address Translation',
    anchor: 'nat',
    aliases: ['router address sharing'],
    description: 'Lets multiple private devices share a public address.',
  },
  {
    term: 'CGNAT',
    title: 'Carrier-Grade NAT',
    anchor: 'cgnat',
    aliases: ['carrier nat', 'shared public ip'],
    description: 'Address sharing performed by an Internet provider.',
  },
  {
    term: 'CIDR',
    title: 'Classless Inter-Domain Routing',
    anchor: 'cidr',
    aliases: ['ip range', 'network prefix'],
    description: 'A compact notation for an IP address range.',
  },
  {
    term: 'RIR',
    title: 'Regional Internet Registry',
    anchor: 'rir',
    aliases: ['address registry'],
    description: 'A regional organization that allocates Internet number resources.',
  },
  {
    term: 'Latency',
    title: 'Application response time',
    anchor: 'latency',
    aliases: ['delay', 'ping', 'response time'],
    description: 'How long a browser request takes to receive a response.',
  },
  {
    term: 'Jitter',
    title: 'Latency variation',
    anchor: 'jitter',
    aliases: ['variation', 'unstable delay'],
    description: 'How much response time changes between samples.',
  },
  {
    term: 'RTT',
    title: 'Round-Trip Time',
    anchor: 'rtt',
    aliases: ['round trip', 'tcp timing'],
    description: 'The time for data to travel to a server and back.',
  },
  {
    term: 'MinRTT',
    title: 'Minimum Round-Trip Time',
    anchor: 'minrtt',
    aliases: ['minimum rtt'],
    description: 'The lowest TCP round-trip time observed during a transfer.',
  },
  {
    term: 'RTTVar',
    title: 'Round-Trip Time Variation',
    anchor: 'rttvar',
    aliases: ['rtt variation'],
    description: 'TCP’s estimate of variation in round-trip time.',
  },
  {
    term: 'TCP',
    title: 'Transmission Control Protocol',
    anchor: 'tcp',
    aliases: ['retransmission', 'reliable transport'],
    description: 'Reliable, ordered data delivery used by web transfers.',
  },
  {
    term: 'ICMP',
    title: 'Internet Control Message Protocol',
    anchor: 'icmp',
    aliases: ['classic ping', 'echo request'],
    description: 'A network diagnostic protocol used by classic ping.',
  },
  {
    term: 'HTTP',
    title: 'Hypertext Transfer Protocol',
    anchor: 'http',
    aliases: ['web request'],
    description: 'The request-and-response protocol used by web pages.',
  },
  {
    term: 'HTTPS',
    title: 'Encrypted HTTP',
    anchor: 'https',
    aliases: ['secure web', 'tls'],
    description: 'HTTP protected by encryption and server identity checks.',
  },
  {
    term: 'Host',
    title: 'Host ICE candidate',
    anchor: 'host',
    aliases: ['local candidate', 'private webrtc address'],
    description: 'A WebRTC candidate for a local network interface.',
  },
  {
    term: 'srflx',
    title: 'Server-reflexive ICE candidate',
    anchor: 'srflx',
    aliases: ['server reflexive', 'stun candidate', 'public webrtc address'],
    description: 'The public-facing address observed by a STUN server.',
  },
  {
    term: 'Relay',
    title: 'TURN relay candidate',
    anchor: 'relay',
    aliases: ['forwarded webrtc path'],
    description: 'A WebRTC path forwarded through a TURN relay.',
  },
  {
    term: 'ICE',
    title: 'Interactive Connectivity Establishment',
    anchor: 'ice',
    aliases: ['candidate gathering', 'webrtc connection'],
    description: 'WebRTC’s process for finding a working connection path.',
  },
  {
    term: 'STUN',
    title: 'Session Traversal Utilities for NAT',
    anchor: 'stun',
    aliases: ['public address discovery', 'stun candidate'],
    description: 'A helper service that reports how an address appears externally.',
  },
  {
    term: 'TURN',
    title: 'Traversal Using Relays around NAT',
    anchor: 'turn',
    aliases: ['webrtc relay'],
    description: 'A relay service used when a direct WebRTC path cannot connect.',
  },
  {
    term: 'mDNS',
    title: 'Multicast DNS',
    anchor: 'mdns',
    aliases: ['local hostname', '.local', 'obfuscated host'],
    description: 'A local naming protocol used by browsers to obscure host addresses.',
  },
  {
    term: 'WebRTC',
    title: 'Web Real-Time Communication',
    anchor: 'webrtc',
    aliases: ['browser calls', 'ice candidates'],
    description: 'Browser technology for real-time audio, video, and data.',
  },
  {
    term: 'VPN',
    title: 'Virtual Private Network',
    anchor: 'vpn',
    aliases: ['tunnel', 'vpn provider'],
    description: 'Routes traffic through another network endpoint.',
  },
  {
    term: 'Proxy',
    title: 'Traffic intermediary',
    anchor: 'proxy',
    aliases: ['forwarder', 'corporate gateway'],
    description: 'A server that forwards requests or traffic for a device.',
  },
  {
    term: 'Tor',
    title: 'The Onion Router',
    anchor: 'tor',
    aliases: ['onion routing', 'relay network'],
    description: 'Routes traffic through multiple relays to obscure its path.',
  },
  {
    term: 'DNS',
    title: 'Domain Name System',
    anchor: 'dns',
    aliases: ['name lookup', 'dns leak'],
    description: 'Looks up network addresses for domain names.',
  },
  {
    term: 'M-Lab',
    title: 'Measurement Lab',
    anchor: 'mlab',
    aliases: ['measurement lab', 'speed test server'],
    description: 'An open Internet measurement project used by PingMetric.',
  },
  {
    term: 'NDT7',
    title: 'Network Diagnostic Tool version 7',
    anchor: 'ndt7',
    aliases: ['mlab test', 'throughput test'],
    description: 'M-Lab’s end-to-end throughput measurement protocol.',
  },
  {
    term: 'Bufferbloat',
    title: 'Excessive queueing delay',
    anchor: 'bufferbloat',
    aliases: ['loaded latency', 'queueing'],
    description: 'Extra latency caused by queues that build under load.',
  },
  {
    term: 'Mbps',
    title: 'Megabits per second',
    anchor: 'mbps',
    aliases: ['megabits', 'speed unit'],
    description: 'A common unit for connection throughput.',
  },
  {
    term: 'Mbps vs MB/s',
    title: 'Bits and bytes',
    anchor: 'mbps-vs-mbs',
    aliases: ['megabytes per second', 'speed conversion'],
    description: 'Eight megabits per second equal one megabyte per second.',
  },
  {
    term: 'Net Neutrality Check',
    title: 'Browser heuristic',
    anchor: 'net-neutrality',
    aliases: ['traffic differentiation', 'throttling test'],
    description: 'A cautious comparison of browser-visible service paths.',
  },
] as const;

export function searchGuideTerms(query: string): readonly GuideTerm[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return GUIDE_TERMS.filter((entry) =>
    [entry.term, entry.title, ...entry.aliases].some((value) =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );
}
