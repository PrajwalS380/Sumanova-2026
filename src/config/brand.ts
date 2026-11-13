/** Branding is configurable via env so the app can be re-skinned without code changes. */
export const brand = {
  name: (import.meta.env.VITE_APP_NAME as string | undefined) ?? 'SUMANOVA',
  tagline: 'Every moment, glowing.',
} as const;
