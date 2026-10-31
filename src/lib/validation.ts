/**
 * Validation for data written to the database. We use Zod's "mini" build: same checks
 * as regular Zod, about a quarter of the download (keeps the first load under budget).
 * Always import `z` from here, never from 'zod' directly.
 */
import * as z from 'zod/mini';

// The Content-Security-Policy forbids eval, so Zod must not compile schemas at runtime.
z.config({ jitless: true });

export { z };

/** Any schema: `Schema<Output, Input>`. */
export type Schema<O = unknown, I = O> = z.ZodMiniType<O, I>;

/** The error thrown when validation fails. */
export const ValidationError = z.core.$ZodError;

export const isValidationError = (err: unknown): err is z.core.$ZodError =>
  err instanceof ValidationError;

/** First human-readable message from a validation error. */
export const firstIssue = (err: unknown): string | undefined =>
  isValidationError(err) ? err.issues[0]?.message : undefined;
