import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, type QueryResultRow } from 'pg';
import type {
  Assignment,
  AssignmentInput,
  AssignmentPatch,
  AssignmentPriority,
  AssignmentQuery,
  AssignmentStatus,
  Summary,
} from './domain';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  oauth_provider: string | null;
  oauth_subject: string | null;
}

interface AssignmentRow extends QueryResultRow {
  id: string;
  title: string;
  course: string;
  description: string;
  due_at: Date;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  created_at: Date;
  updated_at: Date;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  oauthProvider: string | null;
  oauthSubject: string | null;
}

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

export async function migrate(pool: Pool): Promise<void> {
  const sqlPath = path.resolve(__dirname, '../sql/001_init.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    oauthProvider: row.oauth_provider,
    oauthSubject: row.oauth_subject,
  };
}

function mapAssignment(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    description: row.description,
    dueAt: row.due_at.toISOString(),
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function insertUser(
  pool: Pool,
  input: { email: string; name: string; passwordHash: string },
): Promise<UserRecord> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, password_hash, oauth_provider, oauth_subject`,
    [input.email.toLowerCase(), input.name, input.passwordHash],
  );
  return mapUser(result.rows[0]);
}

export async function insertOAuthUser(
  pool: Pool,
  input: { email: string; name: string; provider: string; subject: string },
): Promise<UserRecord> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (email, name, oauth_provider, oauth_subject)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, password_hash, oauth_provider, oauth_subject`,
    [input.email.toLowerCase(), input.name, input.provider, input.subject],
  );
  return mapUser(result.rows[0]);
}

export async function findUserByEmail(pool: Pool, email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, email, name, password_hash, oauth_provider, oauth_subject
     FROM users WHERE email = $1`,
    [email.toLowerCase()],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(pool: Pool, id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, email, name, password_hash, oauth_provider, oauth_subject
     FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByOAuth(
  pool: Pool,
  provider: string,
  subject: string,
): Promise<UserRecord | null> {
  const result = await pool.query<UserRow>(
    `SELECT id, email, name, password_hash, oauth_provider, oauth_subject
     FROM users WHERE oauth_provider = $1 AND oauth_subject = $2`,
    [provider, subject],
  );
  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listAssignments(
  pool: Pool,
  userId: string,
  query: AssignmentQuery,
): Promise<Assignment[]> {
  const where = ['user_id = $1'];
  const values: unknown[] = [userId];
  if (query.status) {
    values.push(query.status);
    where.push(`status = $${values.length}`);
  }
  if (query.course) {
    values.push(query.course.trim().toLowerCase());
    where.push(`lower(btrim(course)) = $${values.length}`);
  }
  if (query.onlyOverdue) {
    // Готовое задание с прошедшей датой уже не считается просрочкой.
    where.push(`status <> 'done' AND due_at < now()`);
  }
  const result = await pool.query<AssignmentRow>(
    `SELECT id, title, course, description, due_at, status, priority, created_at, updated_at
     FROM assignments
     WHERE ${where.join(' AND ')}
     ORDER BY (status <> 'done' AND due_at < now()) DESC, due_at ASC, title ASC`,
    values,
  );
  return result.rows.map(mapAssignment);
}

export async function summarizeAssignments(pool: Pool, userId: string): Promise<Summary> {
  const result = await pool.query<{
    total: number;
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
  }>(
    `SELECT
       count(*)::int AS total,
       count(*) FILTER (WHERE status = 'todo')::int AS todo,
       count(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
       count(*) FILTER (WHERE status = 'done')::int AS done,
       count(*) FILTER (WHERE status <> 'done' AND due_at < now())::int AS overdue
     FROM assignments
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return {
    total: row.total,
    todo: row.todo,
    inProgress: row.in_progress,
    done: row.done,
    overdue: row.overdue,
  };
}

export async function getAssignment(
  pool: Pool,
  userId: string,
  id: string,
): Promise<Assignment | null> {
  const result = await pool.query<AssignmentRow>(
    `SELECT id, title, course, description, due_at, status, priority, created_at, updated_at
     FROM assignments
     WHERE user_id = $1 AND id = $2`,
    [userId, id],
  );
  return result.rows[0] ? mapAssignment(result.rows[0]) : null;
}

export async function insertAssignment(
  pool: Pool,
  userId: string,
  input: AssignmentInput,
): Promise<Assignment> {
  const result = await pool.query<AssignmentRow>(
    `INSERT INTO assignments (user_id, title, course, description, due_at, status, priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, course, description, due_at, status, priority, created_at, updated_at`,
    [
      userId,
      input.title,
      input.course,
      input.description,
      input.dueAt,
      input.status,
      input.priority,
    ],
  );
  return mapAssignment(result.rows[0]);
}

export async function updateAssignment(
  pool: Pool,
  userId: string,
  id: string,
  patch: AssignmentPatch,
): Promise<Assignment | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const columns: Array<[string, unknown]> = [
    ['title', patch.title],
    ['course', patch.course],
    ['description', patch.description],
    ['due_at', patch.dueAt],
    ['status', patch.status],
    ['priority', patch.priority],
  ];
  for (const [column, value] of columns) {
    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }
  sets.push(`updated_at = now()`);
  values.push(userId);
  const userIndex = values.length;
  values.push(id);
  const idIndex = values.length;
  const result = await pool.query<AssignmentRow>(
    `UPDATE assignments
     SET ${sets.join(', ')}
     WHERE user_id = $${userIndex} AND id = $${idIndex}
     RETURNING id, title, course, description, due_at, status, priority, created_at, updated_at`,
    values,
  );
  return result.rows[0] ? mapAssignment(result.rows[0]) : null;
}

export async function deleteAssignment(pool: Pool, userId: string, id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM assignments WHERE user_id = $1 AND id = $2`, [
    userId,
    id,
  ]);
  return (result.rowCount ?? 0) > 0;
}
