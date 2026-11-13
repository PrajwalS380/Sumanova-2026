import { z } from 'zod';

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

/** Mirrors the database CHECK constraint on profiles.username. */
export function usernameProblem(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  if (u.length < 3) return 'At least 3 characters';
  if (u.length > 20) return 'At most 20 characters';
  if (!USERNAME_RE.test(u)) return 'Use letters, numbers, dots and underscores';
  if (/^[._]/.test(u) || /[._]$/.test(u)) return "Can't start or end with . or _";
  return null;
}

export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too weak', 'Weak', 'Okay', 'Strong', 'Excellent'] as const;
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

export function ageOn(dob: string, today = new Date()): number {
  const d = new Date(dob + 'T00:00:00');
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

export const MIN_AGE = 13;

export const emailSchema = z.string().trim().email('Enter a valid email');
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Mix letters and numbers');

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  username: z.string().refine((u) => usernameProblem(u) === null, (u) => ({ message: usernameProblem(u) ?? '' })),
  displayName: z.string().trim().min(1, 'Tell us your name').max(40, 'At most 40 characters'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick your birthday')
    .refine((d) => !Number.isNaN(Date.parse(d)) && d > '1900-01-01', 'Pick your birthday')
    .refine((d) => ageOn(d) >= MIN_AGE, `You must be at least ${MIN_AGE}`),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(40, 'At most 40 characters'),
  bio: z.string().max(160, 'At most 160 characters'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export function firstError(result: z.SafeParseReturnType<unknown, unknown>): Record<string, string> {
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const k = String(issue.path[0] ?? 'form');
    if (!out[k]) out[k] = issue.message;
  }
  return out;
}

/** Turns Supabase auth error messages into friendly copy. */
export function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'That email and password don’t match.';
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  if (m.includes('database error saving new user')) return 'That username was just taken. Try another.';
  if (m.includes('network') || m.includes('fetch')) return 'Can’t reach the server. Check your connection.';
  return message || 'Something went wrong. Please try again.';
}
