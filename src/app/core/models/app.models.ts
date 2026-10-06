export type DataState =
  'idle' | 'loading' | 'available' | 'unavailable' | 'unsupported' | 'failed' | 'timed-out';
export type IpFamily = 'ipv4' | 'ipv6' | 'unknown';
export type TestPhase =
  | 'idle'
  | 'preparing'
  | 'finding-server'
  | 'measuring-latency'
  | 'download'
  | 'upload'
  | 'finalizing'
  | 'complete'
  | 'failed'
  | 'cancelled';
export type ThemePreference = 'system' | 'light' | 'dark';
export type SpeedUnitPreference = 'megabits' | 'megabytes';

export interface AppEnvironment {
  production: boolean;
  passwordHash: string;
  authStorageKey: string;
  authExpiryMs: number;
  mlab: { clientName: string; clientVersion: string };
  ip: {
    ipv4Endpoint: string;
    ipv6Endpoint: string;
    universalEndpoint: string;
    intelligenceEndpoint: string;
    intelligenceApiKey: string;
  };
  latency: { probeUrl: string; attempts: number; timeoutMs: number };
  history: { maxEntries: number };
  webrtc: { stunUrls: string[] };
  neutrality: NetNeutralityConfiguration;
}

export interface ServiceResult<T> {
  state: DataState;
  value?: T;
  message?: string;
}
export type IpIntelligenceMode = 'disabled' | 'keyed' | 'anonymous' | 'anonymous-fallback';
export interface IpIntelligenceResult extends ServiceResult<IpIntelligence> {
  providerMode?: IpIntelligenceMode;
}
export type NetNeutralityOverall =
  'no-obvious-differential-behavior' | 'potential-differential-behavior' | 'inconclusive';
export type NetNeutralityTargetClassification =
  'normal' | 'slower-path-observed' | 'reachability-problem' | 'inconclusive';
export type NetNeutralityAttemptOutcome = 'success' | 'failed' | 'timed-out';
export interface NetNeutralityTargetConfig {
  id: string;
  name: string;
  url: string;
}
export interface NetNeutralityConfiguration {
  attempts: number;
  timeoutMs: number;
  minimumSuccessfulSamples: number;
  ratioThreshold: number;
  absoluteDifferenceThresholdMs: number;
  targets: readonly NetNeutralityTargetConfig[];
}
export interface NetNeutralityAttempt {
  targetId: string;
  round: number;
  startedAt: string;
  durationMs?: number;
  outcome: NetNeutralityAttemptOutcome;
}
export interface NetNeutralityRound {
  round: number;
  order: readonly string[];
  attempts: readonly NetNeutralityAttempt[];
}
export interface NetNeutralityTargetResult {
  id: string;
  name: string;
  attempts: readonly NetNeutralityAttempt[];
  successfulAttempts: number;
  failedAttempts: number;
  timeoutAttempts: number;
  successRate: number;
  minimumMs?: number;
  medianMs?: number;
  maximumMs?: number;
  variationMs?: number;
  relativeRatio?: number;
  classification: NetNeutralityTargetClassification;
}
export interface NetNeutralityNetworkContext {
  protocol?: string;
  effectiveType?: string;
  secureContext?: boolean;
  isp?: string;
  asn?: string;
  country?: string;
  region?: string;
  city?: string;
  ipv4?: string;
  ipv6?: string;
}
export interface NetNeutralityReport {
  id: string;
  methodologyVersion: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  configuration: Readonly<Omit<NetNeutralityConfiguration, 'targets'>>;
  rounds: readonly NetNeutralityRound[];
  targets: readonly NetNeutralityTargetResult[];
  networkContext?: Readonly<NetNeutralityNetworkContext>;
  overall: NetNeutralityOverall;
  explanation: string;
}
export interface NetNeutralityProgress {
  round: number;
  totalRounds: number;
  targetName: string;
  completedRequests: number;
  totalRequests: number;
}
export interface IpAddress {
  address: string;
  family: IpFamily;
  source: 'default' | 'ipv4' | 'ipv6';
}
export interface IpAddresses {
  default: ServiceResult<IpAddress>;
  ipv4: ServiceResult<IpAddress>;
  ipv6: ServiceResult<IpAddress>;
  protocol: 'IPv4 only' | 'IPv6 only' | 'Dual stack' | 'Unknown';
}
export interface LatencyResult {
  samplesMs: number[];
  medianMs: number;
  minimumMs: number;
  jitterMs: number;
}
export interface TcpInfo {
  minRttMs?: number;
  rttMs?: number;
  rttVarMs?: number;
  bytesSent?: number;
  bytesReceived?: number;
  bytesAcked?: number;
  bytesRetrans?: number;
}
export interface SpeedDirectionResult {
  mbps?: number;
  liveMbps?: number;
  bytes?: number;
  durationMs?: number;
  tcp?: TcpInfo;
  loadedLatencyMs?: number;
}
export interface ServerInfo {
  hostname?: string;
  city?: string;
  country?: string;
  endpoint?: string;
  observedClientAddress?: string;
}
export interface SpeedTestResult {
  id: string;
  timestamp: string;
  download: SpeedDirectionResult;
  upload: SpeedDirectionResult;
  latency?: LatencyResult;
  server?: ServerInfo;
}
export interface IpIntelligence {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  asn?: string;
  organization?: string;
  network?: string;
  rir?: string;
  companyType?: string;
  vpnProvider?: string;
  datacenterProvider?: string;
  egressService?: string;
  companyDetails?: {
    name?: string;
    domain?: string;
    type?: string;
    network?: string;
    netname?: string;
    abuserScore?: string;
  };
  asnDetails?: {
    asn?: string;
    route?: string;
    description?: string;
    country?: string;
    active?: boolean;
    organization?: string;
    domain?: string;
    abuseEmail?: string;
    type?: string;
    updated?: string;
    rir?: string;
    abuserScore?: string;
  };
  locationDetails?: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
    postalCode?: string;
    timezone?: string;
    localTime?: string;
    utcOffset?: string;
    accuracy?: string;
    latitude?: number;
    longitude?: number;
    callingCode?: string;
    currencyCode?: string;
    continent?: string;
  };
  abuseDetails?: { name?: string; address?: string; email?: string; phone?: string };
  security: Record<
    | 'vpn'
    | 'proxy'
    | 'tor'
    | 'datacenter'
    | 'abuser'
    | 'mobile'
    | 'satellite'
    | 'anycast'
    | 'bogon'
    | 'crawler',
    boolean | undefined
  >;
}
export interface WebRtcCandidate {
  address: string;
  family: IpFamily;
  type: string;
  protocol?: string;
  isMdns: boolean;
}
export interface WebRtcLeakResult {
  state: DataState;
  candidates: WebRtcCandidate[];
  outcome: string;
}
export interface NetworkCapabilities {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  secureContext: boolean;
  webCrypto: boolean;
  webRtc: boolean;
  networkInformation: boolean;
}
export interface StoredSpeedTestResult extends SpeedTestResult {
  version: 1;
  ip?: IpAddresses;
  intelligence?: IpIntelligence;
  capabilities?: NetworkCapabilities;
  retransmissionPercent?: number;
}
