import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ForbiddenError } from './domain-error';

function hostWith(req: Record<string, unknown>) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();
  const req = { url: '/x', method: 'GET', headers: {}, id: 'req-123' };

  it('maps a domain ForbiddenError to 403 with its code and the requestId', () => {
    const { host, res } = hostWith(req);
    filter.catch(new ForbiddenError('nope'), host);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'ForbiddenError', message: 'nope', requestId: 'req-123' }),
    );
  });

  it('collapses unexpected errors to a generic 500 (no internals leaked)', () => {
    const { host, res } = hostWith(req);
    filter.catch(new Error('db password is hunter2'), host);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('surfaces per-field detail from a nestjs-zod ZodValidationException instead of the generic message', () => {
    const zodError = new ZodError([
      { code: 'invalid_type', expected: 'string', received: 'undefined', path: ['email'], message: 'Required' },
    ]);
    // Same response shape nestjs-zod's ZodValidationException builds.
    const exception = new BadRequestException({
      statusCode: 400,
      message: 'Validation failed',
      errors: zodError.errors,
    });

    const { host, res } = hostWith(req);
    filter.catch(exception, host);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: ['email: Required'] }),
    );
  });
});
