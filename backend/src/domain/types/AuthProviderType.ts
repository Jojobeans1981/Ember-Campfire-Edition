export const AUTH_PROVIDER_TYPES = ['dev', 'auth0', 'cognito'] as const;

export type AuthProviderType = (typeof AUTH_PROVIDER_TYPES)[number];
