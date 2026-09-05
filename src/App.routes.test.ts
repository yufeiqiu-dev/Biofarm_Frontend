import { describe, it, expect } from 'vitest';

/**
 * Every navigation target must correspond to a declared route.
 *
 * The bug this exists for: the cart button navigated to "/signin", a path that
 * was never in the route table - sign-in is Cognito's hosted UI. React Router
 * does not complain about an unknown path, it just falls through to the "*"
 * catch-all, so a signed-out shopper clicking the cart landed on the 404 page
 * and nothing anywhere reported a problem. TypeScript cannot catch it either;
 * a route is a string.
 *
 * Sources are read through import.meta.glob rather than the filesystem: it
 * needs no node typings, makes no assumption about the working directory, and
 * resolves the same way the bundler does.
 */

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function declaredRoutes(): RegExp[] {
  const app = sources['./App.tsx'];
  expect(app, 'App.tsx should be readable').toBeTruthy();

  const paths = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  expect(paths.length).toBeGreaterThan(5);

  return paths
    .filter((path) => path !== '*')
    .map((path) => new RegExp(`^${path.replace(/:[^/]+/g, '[^/]+')}$`));
}

function navigationTargets(): { file: string; target: string }[] {
  const found: { file: string; target: string }[] = [];

  for (const [file, text] of Object.entries(sources)) {
    if (file.includes('.test.')) continue;
    for (const match of text.matchAll(/(?:navigate\(|<Link\s+to=)"(\/[^"`$]*)"/g)) {
      found.push({ file, target: match[1] });
    }
  }
  return found;
}

describe('routing', () => {
  it('has no navigation target that falls through to the 404 page', () => {
    const routes = declaredRoutes();
    const targets = navigationTargets();
    expect(targets.length, 'expected to find some navigation calls').toBeGreaterThan(3);

    const dead = targets.filter(({ target }) => {
      const path = target.split('?')[0].replace(/\/$/, '') || '/';
      return !routes.some((route) => route.test(path));
    });

    expect(dead.map(({ file, target }) => `${file} -> ${target}`)).toEqual([]);
  });
});
