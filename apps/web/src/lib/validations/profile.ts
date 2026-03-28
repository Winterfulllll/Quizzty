import { z } from 'zod';

export const profileSchema = z.object({
  username: z
    .string()
    .min(3, 'Минимум 3 символа')
    .max(32, 'Максимум 32 символа')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Только латиница, цифры, _ и -'),
  email: z.email('Введите корректный email'),
  status: z.string().max(128, 'Максимум 128 символов').optional().or(z.literal('')),
  bio: z.string().max(500, 'Максимум 500 символов').optional().or(z.literal('')),
});

export type ProfileInput = z.infer<typeof profileSchema>;
