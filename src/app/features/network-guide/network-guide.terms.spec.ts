import { describe, expect, it } from 'vitest';
import { GUIDE_TERMS, searchGuideTerms } from './network-guide.terms';

describe('Network Guide search', () => {
  it('finds ASN by term and alias', () => {
    expect(searchGuideTerms('ASN').some((entry) => entry.anchor === 'asn')).toBe(true);
    expect(searchGuideTerms('autonomous').some((entry) => entry.anchor === 'asn')).toBe(true);
  });

  it('finds ISP by term and provider alias', () => {
    expect(searchGuideTerms('ISP').some((entry) => entry.anchor === 'isp')).toBe(true);
    expect(searchGuideTerms('provider').some((entry) => entry.anchor === 'isp')).toBe(true);
  });

  it('matches srflx aliases and related STUN entries', () => {
    expect(searchGuideTerms('srflx').some((entry) => entry.anchor === 'srflx')).toBe(true);
    expect(searchGuideTerms('server reflexive').some((entry) => entry.anchor === 'srflx')).toBe(
      true,
    );
    expect(searchGuideTerms('STUN').some((entry) => entry.anchor === 'stun')).toBe(true);
  });

  it('returns no entries for unknown terms and keeps all anchors unique', () => {
    expect(searchGuideTerms('not-a-network-term')).toEqual([]);
    const anchors = GUIDE_TERMS.map((entry) => entry.anchor);
    expect(new Set(anchors).size).toBe(anchors.length);
  });
});
