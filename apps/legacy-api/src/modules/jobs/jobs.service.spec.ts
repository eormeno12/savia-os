import { JobsService } from './jobs.service';
import type { PrismaService } from '../../common/clients/prisma.service';

function mockPrisma(job: Record<string, unknown>) {
  const update = jest.fn().mockResolvedValue(job);
  const create = jest.fn().mockResolvedValue({});
  return {
    prisma: { job: { update }, notification: { create } } as unknown as PrismaService,
    update,
    create,
  };
}

function job(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-1',
    userId: 'user-1',
    type: 'account_export',
    status: 'running',
    resultRef: null,
    error: null,
    ...overrides,
  };
}

describe('JobsService.update', () => {
  it('notifies via Notification(job) when the transition sets status to done', async () => {
    const { prisma, create } = mockPrisma(job({ status: 'done', resultRef: 's3://x' }));
    await new JobsService(prisma).update('job-1', { status: 'done', resultRef: 's3://x' });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        kind: 'job',
        refId: 'job-1',
        data: { type: 'account_export', status: 'done', resultRef: 's3://x', error: null },
      },
    });
  });

  it('notifies via Notification(job) when the transition sets status to failed', async () => {
    const { prisma, create } = mockPrisma(job({ status: 'failed', error: 'boom' }));
    await new JobsService(prisma).update('job-1', { status: 'failed', error: 'boom' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ kind: 'job', userId: 'user-1' }) }),
    );
  });

  it('does not notify on a progress-only update', async () => {
    const { prisma, create } = mockPrisma(job({ status: 'running', progress: 40 }));
    await new JobsService(prisma).update('job-1', { progress: 40 });

    expect(create).not.toHaveBeenCalled();
  });

  it('does not re-notify when a later patch touches an already-terminal job without setting status again', async () => {
    const { prisma, create } = mockPrisma(job({ status: 'done', resultRef: 's3://x' }));
    await new JobsService(prisma).update('job-1', { resultRef: 's3://x' });

    expect(create).not.toHaveBeenCalled();
  });
});
