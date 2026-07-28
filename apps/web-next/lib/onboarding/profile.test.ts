import { describe, expect, it } from 'vitest';
import { getAuthCopy } from '@/lib/auth/auth-i18n';
import {
  normalizeWebsite,
  validateOnboarding as validate,
  type OnboardingInput,
} from './profile';

const en = getAuthCopy('en');
const MESSAGES = {
  fullName: en.errorName,
  phone: en.errorPhone,
  website: en.errorWebsite,
  companyName: en.errorCompany,
  storePlatform: en.errorPlatform,
  monthlyOrders: en.errorOrders,
};

const validateOnboarding = (input: OnboardingInput) => validate(input, MESSAGES);

const VALID: OnboardingInput = {
  fullName: 'Nagy Sabry',
  phone: '+20 100 000 0000',
  website: 'grindctrl.cloud',
  companyName: 'GRINDCTRL',
  storePlatform: 'Shopify',
  monthlyOrders: 'Under 100 a month',
  primaryGoal: '',
};

describe('validateOnboarding', () => {
  it('accepts a complete submission', () => {
    expect(validateOnboarding(VALID)).toEqual({});
  });

  it('requires the lead fields the sales team needs', () => {
    const errors = validateOnboarding({
      fullName: '',
      phone: '',
      website: '',
      companyName: '',
      storePlatform: '',
      monthlyOrders: '',
      primaryGoal: '',
    });
    expect(Object.keys(errors).sort()).toEqual([
      'companyName',
      'fullName',
      'monthlyOrders',
      'phone',
      'storePlatform',
      'website',
    ]);
  });

  it('accepts phone numbers with separators but rejects short or letter input', () => {
    expect(validateOnboarding({ ...VALID, phone: '(202) 555-0143' }).phone).toBeUndefined();
    expect(validateOnboarding({ ...VALID, phone: '12345' }).phone).toBeDefined();
    expect(validateOnboarding({ ...VALID, phone: 'call me' }).phone).toBeDefined();
  });

  it('rejects a hostname with no dot', () => {
    expect(validateOnboarding({ ...VALID, website: 'localhost' }).website).toBeDefined();
    expect(validateOnboarding({ ...VALID, website: 'https://shop.example.co' }).website).toBeUndefined();
  });

  it('leaves the optional goal field alone', () => {
    expect(validateOnboarding({ ...VALID, primaryGoal: '' }).primaryGoal).toBeUndefined();
  });
});

describe('normalizeWebsite', () => {
  it('adds https when the merchant omits the scheme', () => {
    expect(normalizeWebsite('grindctrl.cloud')).toBe('https://grindctrl.cloud');
  });

  it('keeps an existing scheme', () => {
    expect(normalizeWebsite('http://shop.example.com')).toBe('http://shop.example.com');
  });
});
