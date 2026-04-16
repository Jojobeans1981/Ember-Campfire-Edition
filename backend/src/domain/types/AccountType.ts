export const ACCOUNT_TYPES = ['family'] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
