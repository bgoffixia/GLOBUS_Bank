import { expect, test } from '@playwright/test';
import {
  customerProfileFieldLabels,
  formatCustomerProfileValue,
  getMissingCustomerProfileFields,
  isProfileFieldProvided,
} from '../src/lib/customer-profile';

test('all unprovided customer profile details are marked missing', () => {
  expect(getMissingCustomerProfileFields({})).toEqual([
    'First name',
    'Last name',
    'Address',
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
    address: '12 Independence Avenue',
    phone: 'call me',
    country: 'Nigeri@',
    cityOfOrigin: 'Lagos',
    occupation: 'Product designer',
  })).toEqual(['Date of birth']);
  expect(customerProfileFieldLabels).toHaveLength(8);
});

test('blank values count as missing while any nonblank supplied string is present', () => {
  expect(isProfileFieldProvided('   ')).toBe(false);
  expect(isProfileFieldProvided(null)).toBe(false);
  expect(isProfileFieldProvided('not validated')).toBe(true);
});

test('customer profile displays Clerk username and supplied address without adding new required data', () => {
  expect(formatCustomerProfileValue(' ada_mensah ')).toBe('ada_mensah');
  expect(formatCustomerProfileValue(' 12 Independence Avenue ')).toBe('12 Independence Avenue');
  expect(formatCustomerProfileValue('  ')).toBe('Missing');
  expect(getMissingCustomerProfileFields({
    firstName: 'Ada',
    lastName: 'Mensah',
    address: '12 Independence Avenue',
  })).toEqual([
    'Phone number',
    'Country of origin',
    'City of origin',
    'Date of birth',
    'Occupation / employment status',
  ]);
});
