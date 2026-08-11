import { Injectable } from '@nestjs/common';
import type { Job, JobType } from '@prisma/client';
import { PrismaService } from '../../common/clients/prisma.service';
import type { JobDto } from '@savia-os/legacy-contracts';

/** Thin surface over the Job table for the Bandeja (import/export/delete progress). */
@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, type: JobType, total?: number) {
    return this.prisma.job.create({ data: { userId, type, status: 'queued', total: total ?? null } });
  }

  async update(id: string, data: Partial<Pick<Job, 'status' | 'progress' | 'resultRef' | 'error'>>): Promise<Job> {
    const job = await this.prisma.job.update({ where: { id }, data });
    // Bandeja spec (05-rediseno-estructural.md): job completion also notifies via
    // Notification(job), not just the dedicated GET /jobs surface. Gate on `data.status`
    // (the transition itself), not `job.status`, so a later progress-only patch on an
    // already-terminal job can't fire a second notification.
    if (data.status === 'done' || data.status === 'failed') {
      await this.prisma.notification.create({
        data: {
          userId: job.userId,
          kind: 'job',
          refId: job.id,
          data: { type: job.type, status: job.status, resultRef: job.resultRef, error: job.error },
        },
      });
    }
    return job;
  }

  async list(userId: string): Promise<JobDto[]> {
    const jobs = await this.prisma.job.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return jobs.map((j) => this.toDto(j));
  }

  async get(userId: string, id: string): Promise<JobDto | null> {
    const job = await this.prisma.job.findFirst({ where: { id, userId } });
    return job ? this.toDto(job) : null;
  }

  toDto(j: Job): JobDto {
    return {
      id: j.id,
      type: j.type,
      status: j.status,
      progress: j.progress,
      total: j.total,
      resultRef: j.resultRef,
      error: j.error,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    };
  }
}
