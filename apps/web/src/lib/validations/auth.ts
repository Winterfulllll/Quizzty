import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(32, 'Максимум 32 символа')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Только латиница, цифры, _ и -'),
  email: z.email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов').max(128, 'Максимум 128 символов'),
  role: z.enum(['PARTICIPANT', 'ORGANIZER']),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
