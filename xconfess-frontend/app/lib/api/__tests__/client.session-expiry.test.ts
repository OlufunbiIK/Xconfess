/**
 * @jest-environment jsdom
 *
 * Tests for the apiClient response interceptor — specifically the 401
 * (Unauthorized) path that represents a session expiry or invalid session.
 *
 * Acceptance criteria covered:
 *  • Detect the standard authentication failure (401 response)
 *  • Clear stale session state (useAuthStore.logout is called)
 *  • The rejected promise carries the original error (callers can navigate)
 *  • Avoid redirect loops (no retry on 401; the 401 is not re-queued)
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must be before any imports that trigger the module)
// ---------------------------------------------------------------------------

const mockLogout = jest.fn();

jest.mock('@/app/lib/store/authStore', () => ({
  useAuthStore: {
    getState: () => ({ logout: mockLogout }),
  },
}));

jest.mock('@/app/lib/utils/errorHandler', () => ({
  logError: jest.fn(),
  AppError: class AppError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, unknown>;
    constructor(message: string, code = 'UNKNOWN', statusCode = 500, details?: Record<string, unknown>) {
      super(message);
      this.name = 'AppError';
      this.code = code;
      this.statusCode = statusCode;
      this.details = details;
    }
  },
}));

import axios from 'axios';

// Import after mocks so the interceptors are registered with the mocked store
import apiClient from '../client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAxios401(): ReturnType<typeof axios.create> {
  // Simulate an Axios AxiosError with status 401
  const err = Object.assign(new Error('Unauthorized'), {
    isAxiosError: true,
    response: { status: 401, data: { message: 'Session expired' } },
    config: { url: '/api/confessions', __retryCount: 0 },
  });
  return err as unknown as ReturnType<typeof axios.create>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('apiClient response interceptor — session expiry (401)', () => {
  let originalAdapter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'test-uuid' },
      configurable: true,
    });
    originalAdapter = apiClient.defaults.adapter;
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('calls authStore.logout() when a 401 response is received', async () => {
    apiClient.defaults.adapter = async (config) => {
      return Promise.reject(Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: { status: 401, data: {} },
        config,
      }));
    };

    await expect(apiClient.get('/api/confessions')).rejects.toThrow();

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('rejects the promise with the original 401 error (caller can redirect)', async () => {
    apiClient.defaults.adapter = async (config) => {
      return Promise.reject(Object.assign(new Error('Request failed with status code 401'), {
        isAxiosError: true,
        response: { status: 401, data: { message: 'Unauthorized' } },
        config,
      }));
    };

    await expect(apiClient.get('/api/me')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('does NOT retry a 401 (avoids redirect / request loops)', async () => {
    const adapterSpy = jest.fn().mockImplementation(async (config) => {
      return Promise.reject(Object.assign(new Error('401'), {
        isAxiosError: true,
        response: { status: 401, data: {} },
        config,
      }));
    });
    apiClient.defaults.adapter = adapterSpy;

    await expect(apiClient.get('/api/feed')).rejects.toThrow();

    expect(adapterSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call logout() for non-401 errors', async () => {
    apiClient.defaults.adapter = async (config) => {
      return Promise.reject(Object.assign(new Error('Forbidden'), {
        isAxiosError: true,
        response: { status: 403, data: {} },
        config,
      }));
    };

    await expect(apiClient.get('/api/confessions')).rejects.toThrow();

    expect(mockLogout).not.toHaveBeenCalled();
  });
});
