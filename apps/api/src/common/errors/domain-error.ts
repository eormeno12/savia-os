/**
 * Domain errors carry an HTTP status but live in the domain layer — services
 * throw these without importing NestJS HTTP exceptions. The global filter
 * (all-exceptions.filter.ts) maps them to responses. This keeps modules
 * framework-light and testable.
 */
export abstract class DomainError extends Error {
  abstract readonly status: number;
  readonly code: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = new.target.name;
    this.code = code ?? new.target.name;
  }
}

export class UnauthorizedError extends DomainError {
  readonly status = 401;
}
export class ForbiddenError extends DomainError {
  readonly status = 403;
}
export class NotFoundError extends DomainError {
  readonly status = 404;
}
export class ConflictError extends DomainError {
  readonly status = 409;
}
export class ValidationError extends DomainError {
  readonly status = 422;
}
export class RateLimitError extends DomainError {
  readonly status = 429;
}
/** Degradación limpia (D8): a dependency is down — surface 503, never a 500. */
export class UnavailableError extends DomainError {
  readonly status = 503;
}
