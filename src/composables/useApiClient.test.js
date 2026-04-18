import { beforeEach, describe, expect, it, vi } from 'vitest';

const authSessionMock = {
  mode: 'dev',
  getBearerToken: vi.fn(),
  handleUnauthorizedResponse: vi.fn(),
};

vi.mock('./useAuthSession.js', () => ({
  useAuthSession: () => authSessionMock,
}));

function createJsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('useApiClient', () => {
  beforeEach(() => {
    vi.resetModules();
    authSessionMock.mode = 'dev';
    authSessionMock.getBearerToken.mockReset();
    authSessionMock.handleUnauthorizedResponse.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('attaches dev bearer token to requests', async () => {
    authSessionMock.mode = 'dev';
    authSessionMock.getBearerToken.mockResolvedValue('dev:owner');
    fetch.mockImplementation(() => createJsonResponse(200, { id: 'user-1' }));

    const { useApiClient } = await import('./useApiClient.js');
    await useApiClient().getMe();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer dev:owner');
  });

  it('attaches cognito id token to requests', async () => {
    authSessionMock.mode = 'cognito';
    authSessionMock.getBearerToken.mockResolvedValue('id-token-123');
    fetch.mockImplementation(() => createJsonResponse(200, { id: 'user-1' }));

    const { useApiClient } = await import('./useApiClient.js');
    await useApiClient().getMe();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer id-token-123');
  });

  it('adds content type for json body requests', async () => {
    authSessionMock.getBearerToken.mockResolvedValue('dev:owner');
    fetch.mockImplementation(() => createJsonResponse(200, { id: 'profile-1', name: 'Ember' }));

    const { useApiClient } = await import('./useApiClient.js');
    await useApiClient().createProfile('Ember');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.get('content-type')).toBe('application/json');
    expect(fetch.mock.calls[0][1].body).toBe('{"name":"Ember"}');
  });

  it('retries once after 401 in cognito mode and uses a refreshed bearer token', async () => {
    authSessionMock.mode = 'cognito';
    authSessionMock.getBearerToken
      .mockResolvedValueOnce('id-token-old')
      .mockResolvedValueOnce('id-token-new');
    authSessionMock.handleUnauthorizedResponse.mockResolvedValue(true);
    fetch
      .mockImplementationOnce(() => createJsonResponse(401, {
        error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
      }))
      .mockImplementationOnce(() => createJsonResponse(200, { ok: true }));

    const { useApiClient } = await import('./useApiClient.js');
    const result = await useApiClient().getMe();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(authSessionMock.handleUnauthorizedResponse).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.get('authorization')).toBe('Bearer id-token-old');
    expect(fetch.mock.calls[1][1].headers.get('authorization')).toBe('Bearer id-token-new');
    expect(result).toEqual({ ok: true });
  });

  it('does not retry when refresh fails after 401', async () => {
    authSessionMock.mode = 'cognito';
    authSessionMock.getBearerToken.mockResolvedValue('id-token-123');
    authSessionMock.handleUnauthorizedResponse.mockResolvedValue(false);
    fetch.mockImplementation(() => createJsonResponse(401, {
      error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
    }));

    const { ApiError, useApiClient } = await import('./useApiClient.js');

    await expect(useApiClient().getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(ApiError).toBeDefined();
  });

  it('does not retry more than once when second response is also 401', async () => {
    authSessionMock.mode = 'cognito';
    authSessionMock.getBearerToken
      .mockResolvedValueOnce('id-token-old')
      .mockResolvedValueOnce('id-token-new');
    authSessionMock.handleUnauthorizedResponse.mockResolvedValue(true);
    fetch
      .mockImplementationOnce(() => createJsonResponse(401, {
        error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
      }))
      .mockImplementationOnce(() => createJsonResponse(401, {
        error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
      }));

    const { useApiClient } = await import('./useApiClient.js');

    await expect(useApiClient().getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(authSessionMock.handleUnauthorizedResponse).toHaveBeenCalledTimes(1);
  });

  it('does not refresh and retry outside cognito mode', async () => {
    authSessionMock.mode = 'dev';
    authSessionMock.getBearerToken.mockResolvedValue('dev:owner');
    fetch.mockImplementation(() => createJsonResponse(401, {
      error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
    }));

    const { useApiClient } = await import('./useApiClient.js');

    await expect(useApiClient().getMe()).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'AUTH_UNAUTHORIZED',
    });
    expect(authSessionMock.handleUnauthorizedResponse).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
