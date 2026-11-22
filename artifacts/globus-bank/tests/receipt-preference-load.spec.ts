import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const vaultPanel = readFileSync(
  new URL('../src/components/private-vault-panel.tsx', import.meta.url),
  'utf8',
);

test('receipt preference reads bypass browser cache and refresh after returning to the page', () => {
  expect(vaultPanel).toContain("cache: 'no-store'");
  expect(vaultPanel).toContain("refetchOnMount: 'always'");
  expect(vaultPanel).toContain('refetchOnWindowFocus: true');
  expect(vaultPanel).toContain('staleTime: 0');
});
