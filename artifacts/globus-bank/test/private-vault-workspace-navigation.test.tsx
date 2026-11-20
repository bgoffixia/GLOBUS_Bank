import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'node:test';
import { VaultWorkspaceNavigation } from '../src/components/private-vault-workspace-navigation';

test('Vault workspace navigation links target each dedicated control section', () => {
  const html = renderToStaticMarkup(createElement(VaultWorkspaceNavigation, {}));

  assert.match(html, /aria-label="Vault workspace sections"/);
  for (const sectionId of [
    'vault-workspace-overview',
    'vault-workspace-funding',
    'vault-workspace-wallets',
    'vault-workspace-security',
    'vault-workspace-alerts',
    'vault-workspace-notes',
    'vault-workspace-receipts',
    'vault-workspace-email',
  ]) {
    assert.match(html, new RegExp(`href="#${sectionId}"`));
    assert.match(html, new RegExp(`data-testid="vault-workspace-link-${sectionId}"`));
  }
});
