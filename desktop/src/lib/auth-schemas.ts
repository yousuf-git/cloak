import { z } from 'zod';

const email = z.string().min(1, 'Email is required').email('Enter a valid email');

// The master password is the sole key to the vault — enforce real strength.
const masterPassword = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Too long');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your master password'),
  remember: z.boolean().optional(),
});

export const signupSchema = z
  .object({
    email,
    password: masterPassword,
    confirm: z.string(),
    remember: z.boolean().optional(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

export const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type CodeValues = z.infer<typeof codeSchema>;
