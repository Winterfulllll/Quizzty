import type { User } from './auth';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  imageUrl: string | null;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds: number;
  points: number;
  order: number;
  options: QuizOption[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  questions: QuizQuestion[];
}

export interface ActiveSession {
  id: string;
  roomCode: string;
  status: 'LOBBY' | 'IN_PROGRESS';
  createdAt: string;
  _count: { participants: number };
}

export interface QuizListItem {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number; sessions: number };
  activeSessions: ActiveSession[];
}

export interface ActiveParticipantSession {
  id: string;
  roomCode: string;
  status: string;
  quiz: { title: string };
}

export interface CreateQuestionData {
  text: string;
  imageUrl?: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds: number;
  points: number;
  options: { text: string; isCorrect: boolean }[];
}

export interface SessionInfo {
  id: string;
  roomCode: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'SHOWING_RESULTS' | 'FINISHED';
  currentQuestionIndex: number;
  isPublic: boolean;
  maxParticipants: number | null;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    createdById: string;
    questions: { id: string }[];
  };
  participants: {
    id: string;
    userId: string;
    score: number;
    user: { id: string; username: string; avatar: string | null };
  }[];
}

export interface LeaderboardEntry {
  id: string;
  userId: string;
  score: number;
  user: { id: string; username: string; avatar: string | null };
}

export interface SessionQuestion {
  id: string;
  text: string;
  imageUrl: string | null;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds: number;
  points: number;
  options: { id: string; text: string; order: number }[];
  index: number;
  total: number;
}

export interface HostedSessionHistory {
  id: string;
  roomCode: string;
  startedAt: string | null;
  finishedAt: string | null;
  quiz: { id: string; title: string };
  _count: { participants: number };
}

export interface ParticipatedSessionHistory {
  sessionId: string;
  roomCode: string;
  startedAt: string | null;
  finishedAt: string | null;
  quiz: { id: string; title: string };
  participantCount: number;
  score: number;
  rank: number;
}

export interface PublicProfile {
  id: string;
  username: string;
  role: string;
  avatar: string | null;
  status: string | null;
  bio: string | null;
  createdAt: string;
  hostedSessions: HostedSessionHistory[];
  participatedSessions: ParticipatedSessionHistory[];
}

export interface PublicRoom {
  id: string;
  roomCode: string;
  maxParticipants: number | null;
  createdAt: string;
  quiz: {
    title: string;
    description: string | null;
    createdBy: { id: string; username: string; avatar: string | null };
    _count: { questions: number };
  };
  _count: { participants: number };
}

export interface UpdateQuestionData {
  text?: string;
  imageUrl?: string | null;
  type?: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  timeLimitSeconds?: number;
  points?: number;
  options?: { text: string; isCorrect: boolean }[];
}

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

    const data = (await res.json()) as { accessToken: string };

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
        const body = (await retry.json().catch(() => ({}))) as { message?: string };

        throw new ApiError(body.message ?? 'Произошла ошибка', retry.status);
      }

      return (await retry.json()) as T;
    }

    throw new ApiError('Сессия истекла', 401);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };

    throw new ApiError(body.message ?? 'Произошла ошибка', res.status);
  }

  return (await res.json()) as T;
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
        const body = (await retry.json().catch(() => ({}))) as { message?: string };

        throw new ApiError(body.message ?? 'Произошла ошибка', retry.status);
      }

      return (await retry.json()) as T;
    }

    throw new ApiError('Сессия истекла', 401);
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };

    throw new ApiError(body.message ?? 'Произошла ошибка', res.status);
  }

  return (await res.json()) as T;
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

  changePassword(data: { currentPassword: string; newPassword: string }) {
    return request<{ message: string }>('/users/profile/password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPublicProfile(userId: string) {
    return request<PublicProfile>(`/users/${userId}/public`);
  },

  changeRole(role: 'ORGANIZER' | 'PARTICIPANT') {
    return request<User>('/users/profile/role', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  },

  deleteAccount() {
    return request<{ message: string }>('/users/profile', {
      method: 'DELETE',
    });
  },

  // Quizzes
  getQuizzes() {
    return request<QuizListItem[]>('/quizzes');
  },

  getQuiz(id: string) {
    return request<Quiz>(`/quizzes/${id}`);
  },

  createQuiz(data: { title: string; description?: string }) {
    return request<Quiz>('/quizzes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateQuiz(id: string, data: { title?: string; description?: string }) {
    return request<Quiz>(`/quizzes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteQuiz(id: string) {
    return request<{ message: string }>(`/quizzes/${id}`, {
      method: 'DELETE',
    });
  },

  // Questions
  addQuestion(quizId: string, data: CreateQuestionData) {
    return request<QuizQuestion>(`/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateQuestion(quizId: string, questionId: string, data: UpdateQuestionData) {
    return request<QuizQuestion>(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteQuestion(quizId: string, questionId: string) {
    return request<{ message: string }>(`/quizzes/${quizId}/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  uploadQuestionImage(quizId: string, questionId: string, file: File) {
    const formData = new FormData();

    formData.append('image', file);

    return requestMultipart<QuizQuestion>(
      `/quizzes/${quizId}/questions/${questionId}/image`,
      formData,
    );
  },

  deleteQuestionImage(quizId: string, questionId: string) {
    return request<QuizQuestion>(`/quizzes/${quizId}/questions/${questionId}/image`, {
      method: 'DELETE',
    });
  },

  // Sessions
  createSession(quizId: string) {
    return request<SessionInfo>(`/sessions/create/${quizId}`, {
      method: 'POST',
    });
  },

  getSessionByCode(code: string) {
    return request<SessionInfo>(`/sessions/code/${code}`);
  },

  getLeaderboard(sessionId: string) {
    return request<LeaderboardEntry[]>(`/sessions/${sessionId}/leaderboard`);
  },

  deleteSession(sessionId: string) {
    return request<{ message: string }>(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  getActiveParticipantSession() {
    return request<ActiveParticipantSession | null>('/sessions/active/participant');
  },

  leaveSession(sessionId: string) {
    return request<{ message: string }>(`/sessions/leave/${sessionId}`, { method: 'POST' });
  },

  getHostedHistory() {
    return request<HostedSessionHistory[]>('/sessions/history/hosted');
  },

  getParticipatedHistory() {
    return request<ParticipatedSessionHistory[]>('/sessions/history/participated');
  },

  clearHostedHistory() {
    return request<{ message: string }>('/sessions/history/hosted', { method: 'DELETE' });
  },

  clearParticipatedHistory() {
    return request<{ message: string }>('/sessions/history/participated', { method: 'DELETE' });
  },

  getPublicRooms() {
    return request<PublicRoom[]>('/sessions/public');
  },
};
