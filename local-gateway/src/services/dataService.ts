import { QueryResult, QueryResultRow } from 'pg';
import { getPool, isDatabaseConfigured } from '../config/database';
import { DataUnavailableError, HttpError } from '../errors';
import { Task, TaskStats, User, UserWithPassword } from '../types';

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: Task['status'];
  priority: Task['priority'];
  due_date: string | Date | null;
  created_at: Date | string;
  updated_at: Date | string | null;
}

const TASK_COLUMNS = 'id, user_id, title, description, status, priority, due_date, created_at, updated_at';

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  '57P01',
  '53300',
  '08006',
  '08001',
  '08004',
  '28P01',
]);

function toIso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function mapDueDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    due_date: mapDueDate(row.due_date),
    created_at: toIso(row.created_at) || new Date(0).toISOString(),
    updated_at: toIso(row.updated_at),
  };
}

function mapDbError(error: unknown): Error {
  if (error instanceof HttpError || error instanceof DataUnavailableError) return error;
  const err = error as { code?: string; message?: string };
  console.error('[PostgreSQL]', err.code || 'erreur', err.message || 'inconnue');

  if (err.code === '23505') return new HttpError('Un compte avec cette adresse email existe déjà.', 400);
  if (err.code === '23514' || err.code === '22P02' || err.code === '22007') {
    return new HttpError('Données invalides.', 400);
  }
  if (err.code === '23503') return new HttpError('Utilisateur associé introuvable.', 400);
  if ((err.code && CONNECTION_CODES.has(err.code)) || /ECONNREFUSED|timeout|connect/i.test(err.message || '')) {
    return new DataUnavailableError();
  }
  return new HttpError('Erreur interne du serveur de données.', 500);
}

async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  if (!isDatabaseConfigured()) {
    throw new DataUnavailableError('PostgreSQL non configuré. Renseignez DB_NAME et DB_USER.');
  }
  try {
    return await getPool().query<T>(text, params);
  } catch (error) {
    throw mapDbError(error);
  }
}

export const dataService = {
  async getUserByEmail(email: string): Promise<UserWithPassword | null> {
    const result = await query<UserWithPassword>(
      `SELECT id, full_name, email, password_hash, created_at
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, created_at: toIso(row.created_at) };
  },

  async getUserById(id: string): Promise<User | null> {
    const result = await query<User>(
      `SELECT id, full_name, email, created_at FROM users WHERE id = $1::uuid`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { ...row, created_at: toIso(row.created_at) };
  },

  async createUser(data: { full_name: string; email: string; password_hash: string }): Promise<User> {
    const result = await query<User>(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, created_at`,
      [data.full_name.trim(), data.email.trim().toLowerCase(), data.password_hash]
    );
    const row = result.rows[0];
    return { ...row, created_at: toIso(row.created_at) };
  },

  async getTasks(userId: string): Promise<Task[]> {
    const result = await query<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE user_id = $1::uuid ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(mapTask);
  },

  async getTaskById(id: string, userId: string): Promise<Task | null> {
    const result = await query<TaskRow>(
      `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1::uuid AND user_id = $2::uuid`,
      [id, userId]
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  },

  async createTask(data: {
    user_id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    due_date?: string | null;
  }): Promise<Task> {
    const result = await query<TaskRow>(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING ${TASK_COLUMNS}`,
      [data.user_id, data.title.trim(), data.description ? data.description.trim() : null, data.status, data.priority, data.due_date || null]
    );
    return mapTask(result.rows[0]);
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
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (data.title !== undefined) add('title', data.title.trim());
    if (data.description !== undefined) add('description', data.description ? data.description.trim() : null);
    if (data.status !== undefined) add('status', data.status);
    if (data.priority !== undefined) add('priority', data.priority);
    if (data.due_date !== undefined) add('due_date', data.due_date || null);
    if (sets.length === 0) return this.getTaskById(id, userId);

    values.push(id, userId);
    const result = await query<TaskRow>(
      `UPDATE tasks
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length - 1}::uuid AND user_id = $${values.length}::uuid
       RETURNING ${TASK_COLUMNS}`,
      values
    );
    return result.rows[0] ? mapTask(result.rows[0]) : null;
  },

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const result = await query(`DELETE FROM tasks WHERE id = $1::uuid AND user_id = $2::uuid`, [id, userId]);
    return (result.rowCount || 0) > 0;
  },

  async getTaskStats(userId: string): Promise<TaskStats> {
    const result = await query<{ total: number; todo: number; in_progress: number; completed: number }>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'À faire')::int AS todo,
         COUNT(*) FILTER (WHERE status = 'En cours')::int AS in_progress,
         COUNT(*) FILTER (WHERE status = 'Terminée')::int AS completed
       FROM tasks
       WHERE user_id = $1::uuid`,
      [userId]
    );
    const row = result.rows[0];
    return {
      total: Number(row?.total || 0),
      todo: Number(row?.todo || 0),
      inProgress: Number(row?.in_progress || 0),
      completed: Number(row?.completed || 0),
    };
  },
};
