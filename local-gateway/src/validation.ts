import { HttpError } from './errors';
import { TaskPriority, TaskStatus } from './types';

const STATUSES: TaskStatus[] = ['À faire', 'En cours', 'Terminée'];
const PRIORITIES: TaskPriority[] = ['Basse', 'Moyenne', 'Haute'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, label = 'Identifiant'): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(`${label} invalide.`, 400);
  }
  return value;
}

export function optionalUuid(value: unknown, label = 'Identifiant'): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requireUuid(value, label);
}

export function requireEmail(value: unknown): string {
  if (typeof value !== 'string' || !value.includes('@') || value.length > 320) {
    throw new HttpError('Une adresse e-mail valide est obligatoire.', 400);
  }
  return value.trim().toLowerCase();
}

export function requireName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) {
    throw new HttpError('Le nom complet est obligatoire.', 400);
  }
  return value.trim();
}

export function requirePasswordHash(value: unknown): string {
  if (typeof value !== 'string' || !/^\$2[aby]\$\d{2}\$/.test(value) || value.length < 59 || value.length > 200) {
    throw new HttpError('Empreinte de mot de passe invalide.', 400);
  }
  return value;
}

export function requireTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000) {
    throw new HttpError('Le titre de la tâche est obligatoire.', 400);
  }
  return value.trim();
}

export function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 10000) {
    throw new HttpError('Description invalide.', 400);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function requireStatus(value: unknown, fallback: TaskStatus = 'À faire'): TaskStatus {
  const status = (value === undefined || value === null || value === '' ? fallback : value) as TaskStatus;
  if (!STATUSES.includes(status)) {
    throw new HttpError(`Statut invalide. Valeurs autorisées: ${STATUSES.join(', ')}`, 400);
  }
  return status;
}

export function optionalStatus(value: unknown): TaskStatus | undefined {
  if (value === undefined) return undefined;
  return requireStatus(value);
}

export function requirePriority(value: unknown, fallback: TaskPriority = 'Moyenne'): TaskPriority {
  const priority = (value === undefined || value === null || value === '' ? fallback : value) as TaskPriority;
  if (!PRIORITIES.includes(priority)) {
    throw new HttpError(`Priorité invalide. Valeurs autorisées: ${PRIORITIES.join(', ')}`, 400);
  }
  return priority;
}

export function optionalPriority(value: unknown): TaskPriority | undefined {
  if (value === undefined) return undefined;
  return requirePriority(value);
}

export function optionalDueDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError('Date d\'échéance invalide. Format attendu : YYYY-MM-DD.', 400);
  }
  return value;
}
