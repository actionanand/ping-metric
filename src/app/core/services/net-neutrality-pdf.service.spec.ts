import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NetNeutralityReport } from '../models/app.models';
import { createNetNeutralityPdfModel, NetNeutralityPdfService } from './net-neutrality-pdf.service';

const context = {
  protocol: 'Dual stack',
  effectiveType: '4g',
  secureContext: true,
  isp: 'Private ISP Name',
  asn: 'AS64500',
  country: 'Private Country',
  region: 'Private Region',
  city: 'Private City',
  ipv4: '198.51.100.7',
  ipv6: '2001:db8::7',
};

const report: NetNeutralityReport = {
  id: 'PM-NN-TEST',
  methodologyVersion: 'PingMetric-NN-1',
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:10.000Z',
  durationMs: 10_000,
  configuration: {
    attempts: 1,
    timeoutMs: 5000,
    minimumSuccessfulSamples: 1,
    ratioThreshold: 2.5,
    absoluteDifferenceThresholdMs: 150,
  },
  rounds: [],
  targets: [],
  networkContext: context,
  overall: 'inconclusive',
  explanation: 'Insufficient test data.',
};

const privateOptions = { includeNetworkIdentity: false, includePublicIp: false };

describe('NetNeutralityPdfService privacy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('excludes network identity and IP addresses by default while retaining safe context', () => {
    const model = createNetNeutralityPdfModel(report, privateOptions);
    const serialized = JSON.stringify(model);

    expect(model.context).toMatchObject({
      protocol: 'Dual stack',
      effectiveType: '4g',
      secureContext: true,
    });
    for (const value of [
      context.isp,
      context.asn,
      context.country,
      context.region,
      context.city,
      context.ipv4,
      context.ipv6,
    ]) {
      expect(serialized).not.toContain(value);
    }
  });

  it('includes only approved identity fields when identity is explicitly enabled', () => {
    const model = createNetNeutralityPdfModel(report, {
      includeNetworkIdentity: true,
      includePublicIp: false,
    });

    expect(model.context.networkIdentity).toEqual({
      isp: context.isp,
      asn: context.asn,
      country: context.country,
      region: context.region,
      city: context.city,
    });
    expect(model.context.publicIp).toBeUndefined();
  });

  it('requires the separate public-IP option to include addresses', () => {
    const model = createNetNeutralityPdfModel(report, {
      includeNetworkIdentity: false,
      includePublicIp: true,
    });

    expect(model.context.publicIp).toEqual({ ipv4: context.ipv4, ipv6: context.ipv6 });
    expect(model.context.networkIdentity).toBeUndefined();
  });

  it('generates a PDF without making measurement or IP intelligence requests', () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    const doc = new NetNeutralityPdfService().generate(report, privateOptions);

    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the network context captured in the completed report, not later live network data', () => {
    const reportFromNetworkA: NetNeutralityReport = Object.freeze({
      ...report,
      networkContext: Object.freeze({
        ...context,
        isp: 'Network A ISP',
        city: 'Network A City',
        ipv4: '198.51.100.10',
      }),
    });
    const currentNetworkB = {
      ...context,
      isp: 'Network B ISP',
      city: 'Network B City',
      ipv4: '198.51.100.20',
    };
    const model = createNetNeutralityPdfModel(reportFromNetworkA, {
      includeNetworkIdentity: true,
      includePublicIp: true,
    });

    expect(model.context.networkIdentity?.isp).toBe('Network A ISP');
    expect(model.context.networkIdentity?.city).toBe('Network A City');
    expect(model.context.publicIp?.ipv4).toBe('198.51.100.10');
    expect(JSON.stringify(model)).not.toContain(currentNetworkB.isp);
  });
});
