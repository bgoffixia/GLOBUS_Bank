import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const notificationsCenter = readFileSync(
  new URL('../src/components/notifications-center.tsx', import.meta.url),
  'utf8',
);

test('browser notification permission is requested from an explicit user action', () => {
  expect(notificationsCenter).toContain('const enableBrowserNotifications = async () =>');
  expect(notificationsCenter).toContain('await Notification.requestPermission()');
  expect(notificationsCenter).toContain('onClick={() => void enableBrowserNotifications()}');
  expect(notificationsCenter).toContain('data-testid="button-enable-browser-notifications"');
});

test('browser alert setup handles blocked permission and persists the linked device', () => {
  expect(notificationsCenter).toContain("if (Notification.permission === 'denied')");
  expect(notificationsCenter).toContain('Allow notifications for this site in your browser settings');
  expect(notificationsCenter).toContain('localStorage.setItem(subscriptionStorageKey, result.id)');
  expect(notificationsCenter).toContain('setSavedSubscriptionId(result.id)');
  expect(notificationsCenter).toContain('getGetBankPushConfigQueryKey()');
});
