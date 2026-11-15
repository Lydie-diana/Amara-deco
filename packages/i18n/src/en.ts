import type { Resources } from './types';

export const en: Resources = {
  common: {
    appName: 'Amara',
    tagline: 'Artisans · Decoration',
    languageToggle: 'Français',
    back: 'Back',
    continue: 'Continue',
    loading: 'Loading…',
    configMissing: 'Sign-in is not configured yet. Add the Supabase keys to the .env file.',
  },
  home: {
    title: 'Dress your home,',
    titleAccent: 'handmade.',
    subtitle: 'Order a one-of-a-kind piece or book an artisan near you.',
    categories: 'Categories',
    sculpture: 'Sculpture',
    furniture: 'Furniture',
    textile: 'Textiles',
    lighting: 'Lighting',
    services: 'Services',
    signIn: 'Sign in',
  },
  auth: {
    title: 'Welcome to Amara',
    phoneLabel: 'Your phone number',
    phonePlaceholder: '6 99 12 34 56',
    phoneInvalid: 'Enter a 9-digit Cameroonian number.',
    sendCode: 'Get a code by SMS',
    codeLabel: 'Code received by SMS',
    codeSentTo: 'Code sent to {{phone}}',
    verify: 'Confirm',
    changeNumber: 'Change number',
    error: 'Something went wrong. Please try again in a moment.',
    signedIn: 'You are signed in.',
    signOut: 'Sign out',
  },
  pro: {
    title: 'Amara Pro',
    welcome: 'Hello',
    comingSoon: 'Your dashboard arrives in the next step.',
  },
  admin: {
    title: 'Amara Admin',
    comingSoon: 'Merchant approval arrives in the next step.',
  },
};
