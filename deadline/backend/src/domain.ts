import { z } from 'zod';

export const STATUSES = ['todo', 'in_progress', 'done'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;

export type AssignmentStatus = (typeof STATUSES)[number];
export type AssignmentPriority = (typeof PRIORITIES)[number];

export interface Assignment {
  id: string;
  title: string;
  course: string;
  description: string;
  dueAt: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  createdAt: string;
  updatedAt: string;
}

const dueAtSchema = z
  .string()
  .min(1, 'Укажите дедлайн')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Дата дедлайна не разбирается');

export const registerSchema = z.object({
  email: z.string().trim().email('Укажите корректную почту').max(200),
  name: z.string().trim().min(1, 'Укажите имя').max(80),
  password: z.string().min(8, 'Пароль не короче 8 символов').max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Укажите корректную почту'),
  password: z.string().min(1, 'Введите пароль'),
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(1, 'Укажите название').max(200),
  course: z.string().trim().min(1, 'Укажите предмет').max(120),
  description: z.string().trim().max(4000).optional().default(''),
  dueAt: dueAtSchema,
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
});

export const assignmentPatchSchema = z
  .object({
    title: z.string().trim().min(1, 'Укажите название').max(200).optional(),
    course: z.string().trim().min(1, 'Укажите предмет').max(120).optional(),
    description: z.string().trim().max(4000).optional(),
    dueAt: dueAtSchema.optional(),
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'Нет полей для обновления',
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type AssignmentPatch = z.infer<typeof assignmentPatchSchema>;

export interface AssignmentQuery {
  status?: AssignmentStatus;
  course?: string;
  onlyOverdue: boolean;
}

export function parseAssignmentQuery(query: Record<string, unknown>): AssignmentQuery {
  const statusRaw = typeof query.status === 'string' ? query.status : '';
  const status = STATUSES.find((item) => item === statusRaw);
  const course = typeof query.course === 'string' ? query.course.trim() : '';
  const onlyOverdue = query.overdue === '1' || query.overdue === 'true';
  return {
    status,
    course: course || undefined,
    onlyOverdue,
  };
}

export interface Summary {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
}
