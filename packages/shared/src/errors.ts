export type DomainErrorCode =
  | 'ENTRY_NOT_FOUND'
  | 'FIRST_ENTRY_NOT_DELETABLE'
  | 'FIRST_ENTRY_MUST_BE_APPLIED'
  | 'ENTRY_BEFORE_APPLIED'
  | 'NOT_FOUND';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}
