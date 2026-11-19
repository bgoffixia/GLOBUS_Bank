import { expect, test } from '@playwright/test';
import {
  customerProfileFieldLabels,
  getMissingCustomerProfileFields,
  isProfileFieldProvided,
} from '../src/lib/customer-profile';

test('all unprovided customer profile details are marked missing', () => {
  expect(getMissingCustomerProfileFields({})).toEqual([
    'First name',
    'Last name',
    'Phone number',
    'Country of origin',
    'City of origin',
    'Date of birth',
    'Occupation / employment status',
  ]);
});

test('supplied profile values are compared without requiring optional fields', () => {
  expect(getMissingCustomerProfileFields({
    firstName: 'Ada',
    lastName: 'Mensah',
    phone: 'call me',
    country: 'Nigeri@',
    cityOfOrigin: 'Lagos',
    occupation: 'Product designer',
  })).toEqual(['Date of birth']);
  expect(customerProfileFieldLabels).toHaveLength(7);
});

test('blank values count as missing while any nonblank supplied string is present', () => {
  expect(isProfileFieldProvided('   ')).toBe(false);
  expect(isProfileFieldProvided(null)).toBe(false);
  expect(isProfileFieldProvided('not validated')).toBe(true);
});
