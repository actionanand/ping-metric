import { describe, expect, it } from 'vitest';
import { sha1 } from './auth.service';

describe('SHA-1 authentication helper', () => {
  it('produces a lowercase Web Crypto SHA-1 digest', async () => {
    await expect(sha1('abc')).resolves.toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });
});
