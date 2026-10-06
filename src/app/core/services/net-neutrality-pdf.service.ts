import { Service } from '@angular/core';
import autoTable from 'jspdf-autotable';
import { jsPDF } from 'jspdf';
import type { NetNeutralityReport } from '../models/app.models';

export interface NetNeutralityExportOptions {
  includeNetworkIdentity: boolean;
  includePublicIp: boolean;
}

export interface NetNeutralityExportContext {
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

export interface NetNeutralityPdfModel {
  report: NetNeutralityReport;
  includedOptions: NetNeutralityExportOptions;
  context: {
    protocol?: string;
    effectiveType?: string;
    secureContext?: boolean;
    networkIdentity?: {
      isp?: string;
      asn?: string;
      country?: string;
      region?: string;
      city?: string;
    };
    publicIp?: { ipv4?: string; ipv6?: string };
  };
}

export function createNetNeutralityPdfModel(
  report: NetNeutralityReport,
  options: NetNeutralityExportOptions,
  context: NetNeutralityExportContext,
): NetNeutralityPdfModel {
  return {
    report,
    includedOptions: { ...options },
    context: {
      protocol: context.protocol,
      effectiveType: context.effectiveType,
      secureContext: context.secureContext,
      ...(options.includeNetworkIdentity
        ? {
            networkIdentity: {
              isp: context.isp,
              asn: context.asn,
              country: context.country,
              region: context.region,
              city: context.city,
            },
          }
        : {}),
      ...(options.includePublicIp ? { publicIp: { ipv4: context.ipv4, ipv6: context.ipv6 } } : {}),
    },
  };
}

function display(value: number | undefined, digits = 1): string {
  return value === undefined ? 'Not measured' : value.toFixed(digits);
}

function overallLabel(report: NetNeutralityReport): string {
  switch (report.overall) {
    case 'no-obvious-differential-behavior':
      return 'No obvious differential behavior observed';
    case 'potential-differential-behavior':
      return 'Potential differential behavior observed';
    default:
      return 'Inconclusive';
  }
}

function classificationLabel(value: string): string {
  switch (value) {
    case 'slower-path-observed':
      return 'Slower path observed';
    case 'reachability-problem':
      return 'Reachability problem';
    case 'inconclusive':
      return 'Inconclusive';
    default:
      return 'Normal';
  }
}

function footer(doc: jsPDF, reportId: string): void {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(90);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.text(`PingMetric · ${reportId}`, 14, footerY);
    doc.text(`${page} / ${pages}`, doc.internal.pageSize.getWidth() - 14, footerY, {
      align: 'right',
    });
  }
}

function lastTableEndY(doc: jsPDF): number {
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
  if (finalY === undefined) throw new Error('PDF table did not produce a final position.');
  return finalY;
}

function addSummaryTable(doc: jsPDF, report: NetNeutralityReport, startY: number): number {
  autoTable(doc, {
    startY,
    head: [
      [
        'Service',
        'Attempts',
        'Success',
        'Failures',
        'Timeouts',
        'Success rate',
        'Min ms',
        'Median ms',
        'Max ms',
        'MAD ms',
        'Ratio',
        'Result',
      ],
    ],
    body: report.targets.map((target) => [
      target.name,
      String(target.attempts.length),
      String(target.successfulAttempts),
      String(target.failedAttempts),
      String(target.timeoutAttempts),
      `${target.successRate.toFixed(1)}%`,
      display(target.minimumMs),
      display(target.medianMs),
      display(target.maximumMs),
      display(target.variationMs),
      display(target.relativeRatio, 2),
      classificationLabel(target.classification),
    ]),
    styles: { fontSize: 6.5, cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { fillColor: [22, 130, 77] },
    margin: { left: 14, right: 14 },
  });
  return lastTableEndY(doc) + 8;
}

@Service()
export class NetNeutralityPdfService {
  download(
    report: NetNeutralityReport,
    options: NetNeutralityExportOptions,
    context: NetNeutralityExportContext,
    charts: { medians?: string; attempts?: string } = {},
  ): void {
    const doc = this.generate(report, options, context, charts);
    const timestamp = new Date(report.completedAt).toISOString();
    const stamp = `${timestamp.slice(0, 10)}-${timestamp.slice(11, 19).replaceAll(':', '')}`;
    doc.save(`pingmetric-net-neutrality-${stamp}.pdf`);
  }

  generate(
    report: NetNeutralityReport,
    options: NetNeutralityExportOptions,
    context: NetNeutralityExportContext,
    charts: { medians?: string; attempts?: string } = {},
  ): jsPDF {
    const model = createNetNeutralityPdfModel(report, options, context);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const margin = 14;
    let cursorY = 18;

    doc.setFontSize(20);
    doc.setTextColor(21, 55, 42);
    doc.text('PingMetric', margin, cursorY);
    cursorY += 9;
    doc.setFontSize(15);
    doc.text('Net Neutrality Check Report', margin, cursorY);
    cursorY += 9;
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    doc.text(
      'Browser heuristic · experimental browser-based traffic differentiation check',
      margin,
      cursorY,
    );
    cursorY += 6;
    doc.text(
      `Report ID: ${report.id}    Methodology: ${report.methodologyVersion}`,
      margin,
      cursorY,
    );
    cursorY += 5;
    doc.text(`Generated: ${new Date().toISOString()}`, margin, cursorY);
    cursorY += 5;
    doc.text(
      `Started: ${report.startedAt}    Completed: ${report.completedAt}    Duration: ${(report.durationMs / 1000).toFixed(1)} s`,
      margin,
      cursorY,
    );
    cursorY += 7;
    doc.setFontSize(12);
    doc.setTextColor(22, 130, 77);
    doc.text(overallLabel(report), margin, cursorY);
    cursorY += 6;
    doc.setFontSize(8.5);
    doc.setTextColor(45);
    const explanationLines = doc.splitTextToSize(report.explanation, 268);
    doc.text(explanationLines, margin, cursorY);
    cursorY += explanationLines.length * 4.5 + 3;

    autoTable(doc, {
      startY: cursorY,
      head: [['Test details', 'Value', 'Heuristic thresholds', 'Value']],
      body: [
        [
          'Targets tested',
          String(report.targets.length),
          'Minimum successful samples',
          String(report.configuration.minimumSuccessfulSamples),
        ],
        [
          'Rounds',
          String(report.rounds.length),
          'Relative ratio threshold',
          `${report.configuration.ratioThreshold}x`,
        ],
        [
          'Total requests',
          String(report.rounds.reduce((total, round) => total + round.attempts.length, 0)),
          'Absolute difference threshold',
          `${report.configuration.absoluteDifferenceThresholdMs} ms`,
        ],
        [
          'Execution',
          'Sequential',
          'Timeout per request',
          `${report.configuration.timeoutMs / 1000} s`,
        ],
        [
          'Order',
          'Randomized each round',
          'Attempts per target',
          String(report.configuration.attempts),
        ],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 130, 77] },
      margin: { left: margin, right: margin },
    });
    cursorY = lastTableEndY(doc) + 6;

    const contextRows = [
      [
        'Network identity details',
        options.includeNetworkIdentity ? 'Included by explicit choice' : 'Excluded',
      ],
      ['Public IP addresses', options.includePublicIp ? 'Included by explicit choice' : 'Excluded'],
      ['IP protocol', model.context.protocol ?? 'Not available'],
      ['Browser connection category', model.context.effectiveType ?? 'Not available'],
      [
        'Secure context',
        model.context.secureContext === undefined
          ? 'Not available'
          : model.context.secureContext
            ? 'Yes'
            : 'No',
      ],
    ];
    if (model.context.networkIdentity) {
      const identity = model.context.networkIdentity;
      contextRows.push(
        ['ISP', identity.isp ?? 'Not available'],
        ['ASN', identity.asn ?? 'Not available'],
        ['Country', identity.country ?? 'Not available'],
        ['Region', identity.region ?? 'Not available'],
        ['City', identity.city ?? 'Not available'],
      );
    }
    if (model.context.publicIp) {
      contextRows.push(
        ['IPv4', model.context.publicIp.ipv4 ?? 'Not available'],
        ['IPv6', model.context.publicIp.ipv6 ?? 'Not available'],
      );
    }
    autoTable(doc, {
      startY: cursorY,
      head: [['Context included in this PDF', 'Value']],
      body: contextRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 130, 77] },
      margin: { left: margin, right: margin },
    });

    doc.addPage();
    doc.setFontSize(13);
    doc.setTextColor(21, 55, 42);
    doc.text('Service measurements', margin, 16);
    addSummaryTable(doc, report, 22);

    if (charts.medians || charts.attempts) {
      doc.addPage();
      doc.setFontSize(13);
      doc.setTextColor(21, 55, 42);
      doc.text('Measured timing charts', margin, 16);
      if (charts.medians) doc.addImage(charts.medians, 'PNG', margin, 23, 268, 64);
      if (charts.attempts)
        doc.addImage(charts.attempts, 'PNG', margin, charts.medians ? 96 : 23, 268, 64);
    }

    doc.addPage();
    doc.setFontSize(13);
    doc.setTextColor(21, 55, 42);
    doc.text('Detailed attempts', margin, 16);
    autoTable(doc, {
      startY: 22,
      head: [['Round', 'Service', 'Started', 'Outcome', 'Duration ms']],
      body: report.rounds.flatMap((round) =>
        round.attempts.map((attempt) => [
          String(attempt.round),
          report.targets.find((target) => target.id === attempt.targetId)?.name ?? attempt.targetId,
          attempt.startedAt,
          attempt.outcome,
          display(attempt.durationMs),
        ]),
      ),
      styles: { fontSize: 7.5, cellPadding: 1.7 },
      headStyles: { fillColor: [22, 130, 77] },
      margin: { left: margin, right: margin },
    });
    let lastY = lastTableEndY(doc) + 8;
    if (lastY > 180) {
      doc.addPage();
      lastY = 18;
    }
    doc.setFontSize(11);
    doc.setTextColor(21, 55, 42);
    doc.text('Interpretation and limitations', margin, lastY);
    lastY += 6;
    doc.setFontSize(8.5);
    doc.setTextColor(45);
    const limitations = [
      'This is a browser heuristic, not a controlled application replay or legal determination. It cannot prove intent or establish a net-neutrality violation.',
      'Observed differences can be caused by CDN placement, destination load, peering, routing, DNS, VPNs, proxies, corporate gateways such as Zscaler, firewalls, browser extensions, temporary congestion, outages, rate limits, or actual blocking/throttling.',
      'Requests use opaque no-cors responses where required. A resolved request indicates a browser-visible completion; PingMetric cannot inspect its status or body.',
      'A single slow request is insufficient evidence. Repeated measurements at different times can provide useful additional context. This result does not guarantee that all Internet traffic is treated equally.',
    ];
    for (const paragraph of limitations) {
      const lines = doc.splitTextToSize(paragraph, 268);
      if (lastY + lines.length * 4.2 > doc.internal.pageSize.getHeight() - 18) {
        doc.addPage();
        lastY = 18;
      }
      doc.text(lines, margin, lastY);
      lastY += lines.length * 4.2 + 3;
    }

    footer(doc, report.id);
    return doc;
  }
}
