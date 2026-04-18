import { useAuthSession } from './useAuthSession.js';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
}

async function request(path, options = {}, attempt = 0) {
  const authSession = useAuthSession();
  const headers = new Headers(options.headers ?? {});
  const authToken = await authSession.getBearerToken();

  if (authToken) {
    headers.set('authorization', `Bearer ${authToken}`);
  }

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && authSession.mode === 'cognito' && attempt === 0) {
    const refreshed = await authSession.handleUnauthorizedResponse();

    if (refreshed) {
      return request(path, options, attempt + 1);
    }
  }

  if (!response.ok) {
    let payload = null;

    try {
      payload = await response.json();
    } catch (_) {
      payload = null;
    }

    const message = payload?.error?.message || `Request failed with status ${response.status}`;
    const code = payload?.error?.code || null;
    throw new ApiError(message, response.status, code);
  }

  return response.json();
}

export function useApiClient() {
  return {
    getMe() {
      return request('/me');
    },
    getAccount() {
      return request('/account');
    },
    getProfiles() {
      return request('/profiles');
    },
    createProfile(name) {
      return request('/profiles', {
        method: 'POST',
        body: { name },
      });
    },
    getProfileProgress(profileId) {
      return request(`/profiles/${profileId}/progress`);
    },
    submitProgressOperations(profileId, baseVersion, operations) {
      return request(`/profiles/${profileId}/progress-operations`, {
        method: 'POST',
        body: {
          baseVersion,
          operations,
        },
      });
    },
    submitProgressSnapshot(profileId, snapshot) {
      return request(`/profiles/${profileId}/progress-snapshot`, {
        method: 'PUT',
        body: snapshot,
      });
    },
    appendEvents(profileId, events) {
      return request(`/profiles/${profileId}/events`, {
        method: 'POST',
        body: {
          events,
        },
      });
    },
  };
}
