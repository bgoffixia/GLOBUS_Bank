import { test, expect } from '@playwright/test';
import { authFailureMessage } from '../src/lib/auth-errors';
import {
  getUsernameRecoveryNextStep,
  parseRecoveryLookup,
  supportsEmailCodeRecovery,
  validateSignInCredentials,
} from '../src/lib/sign-in-validation';

const usernameLimits = { usernameMinLength: 4, usernameMaxLength: 64 };

test('requires only a configured username and password for login', () => {
  expect(validateSignInCredentials({
    username: '',
    password: 'placeholder',
    ...usernameLimits,
  })).toEqual({ field: 'username', message: 'Enter your username.' });
  expect(validateSignInCredentials({
    username: 'abc',
    password: 'placeholder',
    ...usernameLimits,
  })?.message).toBe('Username must be between 4 and 64 characters.');
  expect(validateSignInCredentials({
    username: 'member_name-4',
    password: '',
    ...usernameLimits,
  })).toEqual({ field: 'password', message: 'Enter your password.' });
  expect(validateSignInCredentials({
    username: 'member_name-4',
    password: 'x',
    ...usernameLimits,
  })).toBeNull();
});

test('accepts only email or a seven-character Customer ID for recovery lookup', () => {
  expect(parseRecoveryLookup('  ABC1234 ')).toEqual({
    type: 'customerId',
    customerId: 'ABC1234',
  });
  expect(parseRecoveryLookup('member@example.test')).toEqual({
    type: 'email',
    email: 'member@example.test',
  });
  expect(parseRecoveryLookup('abc123')).toBeNull();
  expect(parseRecoveryLookup('not-an-email')).toBeNull();
  expect(parseRecoveryLookup('')).toBeNull();
});

test('offers username recovery only when Clerk supports email-code verification', () => {
  expect(supportsEmailCodeRecovery(true, ['email_code'], ['email_code', 'email_link'])).toBe(true);
  expect(supportsEmailCodeRecovery(true, ['email_link'], ['email_link'])).toBe(false);
  expect(supportsEmailCodeRecovery(false, ['email_code'], ['email_code'])).toBe(false);
});

test('reveals a username only after successful verification completes all required factors', () => {
  expect(getUsernameRecoveryNextStep('complete', false)).toBe('reveal-username');
  expect(getUsernameRecoveryNextStep('needs_second_factor', false)).toBe('verify-second-factor');
  expect(getUsernameRecoveryNextStep('needs_client_trust', false)).toBe('verify-second-factor');
  expect(getUsernameRecoveryNextStep('complete', true)).toBe('blocked');
  expect(getUsernameRecoveryNextStep('needs_first_factor', false)).toBe('blocked');
});

test('maps Clerk credential and format errors without identifying an account', () => {
  expect(authFailureMessage(
    { errors: [{ code: 'form_password_or_identifier_incorrect' }] },
    'sign-in',
  )).toBe('The username or password was not accepted. Check your details and try again.');
  expect(authFailureMessage(
    { errors: [{ code: 'form_param_format_invalid' }] },
    'sign-in',
  )).toContain('Check the sign-in details');
  expect(authFailureMessage(
    { errors: [{ code: 'too_many_requests' }] },
    'sign-in',
  )).toContain('Too many attempts');
});
