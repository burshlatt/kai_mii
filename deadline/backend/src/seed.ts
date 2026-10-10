import { hashPassword } from './auth';
import { getConfig } from './config';
import { createPool, findUserByEmail, insertAssignment, insertUser, migrate } from './db';
import { logger } from './logger';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO !== '1') {
    throw new Error('seed is refused in production');
  }
  const config = getConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const email = 'bulat@mail.ru';
  const existing = await findUserByEmail(pool, email);
  if (existing) {
    logger.info({ email }, 'seed user already exists');
    await pool.end();
    return;
  }
  const user = await insertUser(pool, {
    email,
    name: 'Каримов Булат',
    passwordHash: await hashPassword('12345'),
  });
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await insertAssignment(pool, user.id, {
    title: 'Эссе про городской транспорт',
    course: 'История',
    description: 'Три страницы, источники не старше десяти лет.',
    dueAt: new Date(now - 2 * day).toISOString(),
    status: 'todo',
    priority: 'high',
  });
  await insertAssignment(pool, user.id, {
    title: 'Лабораторная по графам',
    course: 'Алгоритмы',
    description: 'Кратчайший путь и разбор сложности.',
    dueAt: new Date(now + 2 * day).toISOString(),
    status: 'in_progress',
    priority: 'medium',
  });
  await insertAssignment(pool, user.id, {
    title: 'Конспект лекции о пределах',
    course: 'Математический анализ',
    description: '',
    dueAt: new Date(now - day).toISOString(),
    status: 'done',
    priority: 'low',
  });
  await insertAssignment(pool, user.id, {
    title: 'План реферата',
    course: 'Философия',
    description: 'Тема: внимание и дедлайны.',
    dueAt: new Date(now + 10 * day).toISOString(),
    status: 'todo',
    priority: 'medium',
  });
  logger.info({ email }, 'seed completed');
  await pool.end();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'seed failed');
  process.exit(1);
});
