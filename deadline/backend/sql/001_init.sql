CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text,
  oauth_provider text,
  oauth_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_identity CHECK (
    password_hash IS NOT NULL
    OR (oauth_provider IS NOT NULL AND oauth_subject IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_oauth_unique
  ON users (oauth_provider, oauth_subject)
  WHERE oauth_provider IS NOT NULL;

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title text NOT NULL,
  course text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_user_due_idx
  ON assignments (user_id, due_at);
