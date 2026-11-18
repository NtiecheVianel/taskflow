import { config } from '../config';
import { DataUnavailableError, HttpError } from '../errors';
import { Task, TaskStats, User, UserWithPassword } from '../types';

export class GatewayRequestError extends HttpError {
  constructor(statusCode: number, message: string) {
    super(message, statusCode);
    this.name = 'GatewayRequestError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

function assertGatewayConfigured(): void {
  if (!config.localGatewayUrl || !config.localGatewayToken) {
    throw new DataUnavailableError(
      'Passerelle locale non configurée. Renseignez LOCAL_GATEWAY_URL et LOCAL_GATEWAY_TOKEN sur Render.'
    );
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  assertGatewayConfigured();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.gatewayTimeoutMs);

  try {
    const response = await fetch(`${config.localGatewayUrl}${path}`, {
      method: options.method || 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-local-gateway-token': config.localGatewayToken,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    let payload: { message?: string } | null = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = payload?.message || 'Erreur de la passerelle de données.';
      // 401/403 ici = secret de passerelle refusé, pas une session utilisateur.
      // Le frontend déconnecte l'utilisateur sur un 401 public : on renvoie donc 503.
      if (response.status === 401 || response.status === 403) {
        throw new DataUnavailableError(
          'La passerelle de données a refusé le backend. Vérifiez LOCAL_GATEWAY_TOKEN.'
        );
      }
      if (response.status === 429 || response.status >= 500) {
        throw new DataUnavailableError('La passerelle de données est indisponible.');
      }
      throw new GatewayRequestError(response.status, message);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DataUnavailableError || error instanceof GatewayRequestError) {
      throw error;
    }
    console.error('[Passerelle] injoignable:', (error as Error).message);
    throw new DataUnavailableError(
      'Impossible de joindre la passerelle de données. Le tunnel ou le PC local est peut-être arrêté.'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const gatewayClient = {
  getUserByEmail(email: string): Promise<UserWithPassword | null> {
    return request<UserWithPassword | null>('/api/internal/users/by-email', {
      method: 'POST',
      body: { email },
    });
  },

  getUserById(id: string): Promise<User | null> {
    return request<User | null>(`/api/internal/users/${encodeURIComponent(id)}`);
  },

  createUser(data: { full_name: string; email: string; password_hash: string }): Promise<User> {
    return request<User>('/api/internal/users', {
      method: 'POST',
      body: data,
    });
  },

  getTasks(userId: string): Promise<Task[]> {
    return request<Task[]>(`/api/internal/tasks?userId=${encodeURIComponent(userId)}`);
  },

  getTaskById(id: string, userId: string): Promise<Task | null> {
    return request<Task | null>(
      `/api/internal/tasks/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`
    );
  },

  createTask(data: {
    user_id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    due_date?: string | null;
  }): Promise<Task> {
    return request<Task>('/api/internal/tasks', {
      method: 'POST',
      body: data,
    });
  },

  updateTask(
    id: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      status?: string;
      priority?: string;
      due_date?: string | null;
    }
  ): Promise<Task | null> {
    return request<Task | null>(`/api/internal/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { ...data, userId },
    });
  },

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const result = await request<{ success?: boolean }>(
      `/api/internal/tasks/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return Boolean(result?.success);
  },

  getTaskStats(userId: string): Promise<TaskStats> {
    return request<TaskStats>(`/api/internal/tasks/stats?userId=${encodeURIComponent(userId)}`);
  },

  async healthProbe(): Promise<{ statusCode: number; body: { status?: string; database?: string } | null }> {
    assertGatewayConfigured();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.gatewayTimeoutMs);
    try {
      const response = await fetch(`${config.localGatewayUrl}/api/internal/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'x-local-gateway-token': config.localGatewayToken,
        },
      });
      const text = await response.text();
      let body: { status?: string; database?: string } | null = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = null;
        }
      }
      return { statusCode: response.status, body };
    } catch (error) {
      console.error('[Passerelle] health injoignable:', (error as Error).message);
      return { statusCode: 0, body: null };
    } finally {
      clearTimeout(timeout);
    }
  },
};
