export type TaskStatus = 'À faire' | 'En cours' | 'Terminée';
export type TaskPriority = 'Basse' | 'Moyenne' | 'Haute';

export interface User {
  id: string;
  full_name: string;
  email: string;
  created_at?: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  inProgress: number;
  completed: number;
}
