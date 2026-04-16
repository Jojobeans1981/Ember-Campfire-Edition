export const USER_ROLES = ['owner', 'member'] as const;

export type UserRole = (typeof USER_ROLES)[number];
