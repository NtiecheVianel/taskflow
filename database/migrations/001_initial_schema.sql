-- Schéma initial TaskFlow.
-- Les statuts et priorités sont ceux réellement utilisés par le frontend.
-- PostgreSQL 13+ (gen_random_uuid). pgcrypto couvre aussi les versions plus anciennes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_full_name_not_blank CHECK (length(btrim(full_name)) > 0),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'À faire',
  priority TEXT NOT NULL DEFAULT 'Moyenne',
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tasks_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT tasks_status_check CHECK (status IN ('À faire', 'En cours', 'Terminée')),
  CONSTRAINT tasks_priority_check CHECK (priority IN ('Basse', 'Moyenne', 'Haute'))
);

CREATE INDEX tasks_user_id_created_at_idx ON tasks (user_id, created_at DESC);
