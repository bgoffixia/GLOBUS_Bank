import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const appRoutes = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const countrySelector = readFileSync(
  new URL('../src/components/country-select.tsx', import.meta.url),
  'utf8',
);

test('app pages and country flags do not use lazy loading', () => {
  expect(appRoutes).not.toMatch(/\b(?:React\.)?lazy\s*\(|<Suspense\b|import\s*\(/);
  expect(countrySelector).not.toMatch(/\bloading\s*=\s*['"]lazy['"]/);
});
