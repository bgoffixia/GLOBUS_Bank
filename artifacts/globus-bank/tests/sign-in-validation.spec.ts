import { test, expect } from '@playwright/test';
import { authFailureMessage } from '../src/lib/auth-errors';
import {
  getSignInIdentifierModes,
  resolveSignInIdentifierMode,
  supportsEmailCodeSignIn,
  validateSignInCredentials,
} from '../src/lib/sign-in-validation';

const usernameLimits = { usernameMinLength: 4, usernameMaxLength: 64 };

test('offers only identifiers backed by enabled Clerk attributes', () => {
  expect(getSignInIdentifierModes(true, true)).toEqual(['customerId', 'email', 'username']);
  expect(getSignInIdentifierModes(false, true)).toEqual(['username']);
  expect(getSignInIdentifierModes(true, false)).toEqual(['customerId', 'email']);
  expect(getSignInIdentifierModes(false, false, true)).toEqual(['phone']);
  expect(getSignInIdentifierModes(true, true, true)).toEqual(['customerId', 'email', 'username', 'phone']);
  expect(getSignInIdentifierModes(false, false)).toEqual([]);
});

test('falls back to an enabled identifier when the preferred one is unavailable', () => {
  expect(resolveSignInIdentifierMode('customerId', ['username'])).toBe('username');
  expect(resolveSignInIdentifierMode('email', ['customerId', 'email'])).toBe('email');
  expect(resolveSignInIdentifierMode('username', [])).toBeNull();
});

test('offers email-code sign-in only when Clerk supports that first factor', () => {
  expect(supportsEmailCodeSignIn(true, ['email_code'], ['email_code', 'email_link'])).toBe(true);
  expect(supportsEmailCodeSignIn(true, ['email_link'], ['email_link'])).toBe(false);
  expect(supportsEmailCodeSignIn(false, ['email_code'], ['email_code'])).toBe(false);
});

test('requires and validates the bank Customer ID before lookup', () => {
  expect(validateSignInCredentials({
    mode: 'customerId',
    identifier: '',
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.message).toBe('Enter your Customer ID.');
  expect(validateSignInCredentials({
    mode: 'customerId',
    identifier: 'ABC-123',
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.field).toBe('identifier');
  expect(validateSignInCredentials({
    mode: 'customerId',
    identifier: 'ABC1234',
    password: '',
    ...usernameLimits,
  })).toEqual({ field: 'password', message: 'Enter your password.' });
});

test('validates email syntax without applying signup profile fields', () => {
  expect(validateSignInCredentials({
    mode: 'email',
    identifier: 'not-an-email',
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.message).toBe('Enter a valid email address.');
  expect(validateSignInCredentials({
    mode: 'email',
    identifier: 'member@example.test',
    password: 'not-a-real-password',
    ...usernameLimits,
  })).toBeNull();
});

test('uses the active Clerk username length range and leaves character rules to Clerk', () => {
  expect(validateSignInCredentials({
    mode: 'username',
    identifier: 'abc',
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.message).toBe('Username must be between 4 and 64 characters.');
  expect(validateSignInCredentials({
    mode: 'username',
    identifier: 'member_name-4',
    password: 'not-a-real-password',
    ...usernameLimits,
  })).toBeNull();
  expect(validateSignInCredentials({
    mode: 'username',
    identifier: 'u'.repeat(65),
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.field).toBe('identifier');
});

test('requires a phone identifier but leaves region-specific formatting to Clerk', () => {
  expect(validateSignInCredentials({
    mode: 'phone',
    identifier: '',
    password: 'not-a-real-password',
    ...usernameLimits,
  })?.message).toBe('Enter your phone number.');
  expect(validateSignInCredentials({
    mode: 'phone',
    identifier: '+234 801 234 5678',
    password: 'not-a-real-password',
    ...usernameLimits,
  })).toBeNull();
});

test('does not impose the signup password minimum on existing sign-in credentials', () => {
  expect(validateSignInCredentials({
    mode: 'email',
    identifier: 'member@example.test',
    password: 'x',
    ...usernameLimits,
  })).toBeNull();
  expect(validateSignInCredentials({
    mode: 'email',
    identifier: 'member@example.test',
    password: '',
    ...usernameLimits,
  })).toEqual({ field: 'password', message: 'Enter your password.' });
});

test('maps Clerk credential and format errors without naming the wrong identifier', () => {
  const credentialMessage = authFailureMessage(
    { errors: [{ code: 'form_password_or_identifier_incorrect' }] },
    'sign-in',
  );
  expect(credentialMessage).toBe(
    'The sign-in details were not accepted. Check your identifier and password, then try again.',
  );
  expect(authFailureMessage(
    { errors: [{ code: 'form_param_format_invalid' }] },
    'sign-in',
  )).toContain('Check the sign-in details');
  expect(authFailureMessage(
    { errors: [{ code: 'too_many_requests' }] },
    'sign-in',
  )).toContain('Too many attempts');
});
