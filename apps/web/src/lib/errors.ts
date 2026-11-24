import { DOMAIN_ERROR_MESSAGES, isDomainErrorCode } from './labels';

/** A human-readable message for a failed client call: known domain codes map to friendly text. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string' && isDomainErrorCode(err.code)) {
    return DOMAIN_ERROR_MESSAGES[err.code];
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
