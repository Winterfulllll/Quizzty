import type { User } from './auth';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(
  /\/+$/,
  '',
);

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!res.ok) {
      accessToken = null;
      return null;
    }

    const data: { accessToken: string } = await res.json();
    accessToken = data.accessToken;
    return accessToken;
  } catch {
    accessToken = null;
    return null;
  }
}

function getRefreshPromise(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401 && accessToken) {
    const newToken = await getRefreshPromise();
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
          ...options?.headers,
        },
      });

      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new ApiError(body.message ?? 'Произошла ошибка', retry.status);
      }

      return retry.json();
    }

    throw new ApiError('Сессия истекла', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? 'Произошла ошибка', res.status);
  }

  return res.json();
}

async function requestMultipart<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401 && accessToken) {
    const newToken = await getRefreshPromise();
    if (newToken) {
      const retry = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: `Bearer ${newToken}` },
        body: formData,
      });

      if (!retry.ok) {
        const body = await retry.json().catch(() => ({}));
        throw new ApiError(body.message ?? 'Произошла ошибка', retry.status);
      }

      return retry.json();
    }

    throw new ApiError('Сессия истекла', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? 'Произошла ошибка', res.status);
  }

  return res.json();
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

export const api = {
  login(data: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register(data: { email: string; username: string; password: string; role: string }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  refresh() {
    return getRefreshPromise();
  },

  async logout() {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    accessToken = null;
  },

  me() {
    return request<User>('/auth/me');
  },

  getProfile() {
    return request<User>('/users/profile');
  },

  updateProfile(data: { username?: string; email?: string; status?: string; bio?: string }) {
    return request<User>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('avatar', file);
    return requestMultipart<User>('/users/profile/avatar', formData);
  },

  deleteAccount() {
    return request<{ message: string }>('/users/profile', {
      method: 'DELETE',
    });
  },
};
