import { config, isCloudHost } from '../config';
import { checkDatabase } from '../config/database';
import { DataUnavailableError } from '../errors';
import { Task, TaskStats, User, UserWithPassword } from '../types';
import { gatewayClient } from './gatewayClient';
import { postgresStore } from './postgresStore';

let cloudOverrideWarned = false;

/**
 * Render (et tout hôte cloud) parle uniquement à la passerelle.
 * En local, LOCAL_GATEWAY_URL active le même chemin.
 * DATA_SOURCE=postgres force PostgreSQL pour les tests et le développement local.
 */
export function usesGateway(): boolean {
  const forcePostgres = process.env.DATA_SOURCE === 'postgres';
  if (isCloudHost() || config.nodeEnv === 'production') {
    if (forcePostgres && !cloudOverrideWarned) {
      console.error('DATA_SOURCE=postgres ignoré : le backend cloud ne se connecte pas à PostgreSQL.');
      cloudOverrideWarned = true;
    }
    return true;
  }
  if (process.env.DATA_SOURCE === 'gateway') return true;
  if (forcePostgres) return false;
  return Boolean(config.localGatewayUrl);
}

function assertGatewayReady(): void {
  if (!config.localGatewayUrl || !config.localGatewayToken) {
    throw new DataUnavailableError(
      'Passerelle locale non configurée. Renseignez LOCAL_GATEWAY_URL et LOCAL_GATEWAY_TOKEN.'
    );
  }
}

export const dataService = {
  async getUserByEmail(email: string): Promise<UserWithPassword | null> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.getUserByEmail(email);
    }
    return postgresStore.getUserByEmail(email);
  },

  async getUserById(id: string): Promise<User | null> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.getUserById(id);
    }
    return postgresStore.getUserById(id);
  },

  async createUser(data: { full_name: string; email: string; password_hash: string }): Promise<User> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.createUser(data);
    }
    return postgresStore.createUser(data);
  },

  async getTasks(userId: string): Promise<Task[]> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.getTasks(userId);
    }
    return postgresStore.getTasks(userId);
  },

  async getTaskById(id: string, userId: string): Promise<Task | null> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.getTaskById(id, userId);
    }
    return postgresStore.getTaskById(id, userId);
  },

  async createTask(data: {
    user_id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    due_date?: string | null;
  }): Promise<Task> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.createTask(data);
    }
    return postgresStore.createTask(data);
  },

  async updateTask(
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
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.updateTask(id, userId, data);
    }
    return postgresStore.updateTask(id, userId, data);
  },

  async deleteTask(id: string, userId: string): Promise<boolean> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.deleteTask(id, userId);
    }
    return postgresStore.deleteTask(id, userId);
  },

  async getTaskStats(userId: string): Promise<TaskStats> {
    if (usesGateway()) {
      assertGatewayReady();
      return gatewayClient.getTaskStats(userId);
    }
    return postgresStore.getTaskStats(userId);
  },

  async checkHealth(): Promise<{ status: string; mode: string; details?: unknown }> {
    if (usesGateway()) {
      if (!config.localGatewayUrl || !config.localGatewayToken) {
        return {
          status: 'degraded',
          mode: 'gateway_not_configured',
          details: { error: 'LOCAL_GATEWAY_URL ou LOCAL_GATEWAY_TOKEN manquant' },
        };
      }

      const probe = await gatewayClient.healthProbe();
      if (probe.statusCode === 200 && probe.body?.database === 'up') {
        return { status: 'healthy', mode: 'hybrid_via_gateway', details: { database: 'up' } };
      }
      if (probe.statusCode === 401 || probe.statusCode === 403) {
        return {
          status: 'degraded',
          mode: 'gateway_rejected',
          details: { error: 'Secret de passerelle refusé' },
        };
      }
      if (probe.statusCode >= 500) {
        return {
          status: 'degraded',
          mode: 'postgres_unavailable',
          details: { database: 'down' },
        };
      }
      return {
        status: 'degraded',
        mode: 'gateway_disconnected',
        details: { error: 'Tunnel ou passerelle injoignable' },
      };
    }

    try {
      await checkDatabase();
      return { status: 'healthy', mode: 'postgres_direct', details: { database: 'up' } };
    } catch (error) {
      return {
        status: 'degraded',
        mode: 'postgres_unavailable',
        details: { error: error instanceof Error ? error.message : 'PostgreSQL indisponible' },
      };
    }
  },
};

export { DataUnavailableError } from '../errors';
