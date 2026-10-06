import { describe, expect, it } from 'vitest';
import { environment as production } from '../../../environments/environment';
import { environment as development } from '../../../environments/environment.development';

const expectedNames = ['YouTube', 'Facebook', 'Google', 'Wikipedia', 'Cloudflare'];
const cloudflareUrl = 'https://speed.cloudflare.com/__down?bytes=0';

describe('Net Neutrality target configuration', () => {
  it.each([
    ['production', production],
    ['development', development],
  ])('%s has five unique HTTPS targets including Cloudflare', (_name, environment) => {
    const targets = environment.neutrality.targets;
    const ids = targets.map((target) => target.id);

    expect(targets.map((target) => target.name).sort()).toEqual([...expectedNames].sort());
    expect(new Set(ids).size).toBe(targets.length);
    expect(targets.every((target) => target.url.startsWith('https://'))).toBe(true);
    expect(targets).toContainEqual({
      id: 'cloudflare',
      name: 'Cloudflare',
      url: cloudflareUrl,
    });
  });

  it('configures five rounds and five requests per target for 25 total requests', () => {
    for (const environment of [production, development]) {
      expect(environment.neutrality.targets.length * environment.neutrality.attempts).toBe(25);
    }
  });
});
