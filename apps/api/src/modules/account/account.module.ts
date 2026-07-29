import { Controller, Inject, Injectable, Logger, Module, Post } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../common/clients/prisma.service';
import { VectorStorePort } from '../../common/ports/vector-store.port';
import { QdrantConnection } from '../../common/adapters/qdrant.connection';
import { P } from '../../common/ports/predicate';
import { S3Service } from '../files/s3.service';
import { FilesModule } from '../files/files.module';
import { JobsService } from '../jobs/jobs.service';
import { JobsModule } from '../jobs/jobs.module';
import { CollectiveModule } from '../collective/collective.module';
import { CollectiveService } from '../collective/collective.service';
import { ConnectionsModule } from '../connections/connections.module';
import { ConnectionsService } from '../connections/connections.service';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { ACCOUNT_DELETE_QUEUE, AccountDeleteJobData, accountDeleteQueueProvider } from './account.queue';

/**
 * Account lifecycle (05 §2). Federation makes deletion clean: nothing the user
 * shared was ever moved, so leaving = removing fragments + their own data. Delete
 * purges Postgres (cascade) AND Qdrant (user_id) AND the entity store AND S3 —
 * the cascade only covers Postgres.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectors: VectorStorePort,
    private readonly qdrant: QdrantConnection,
    private readonly s3: S3Service,
    private readonly jobs: JobsService,
    private readonly collective: CollectiveService,
    private readonly connections: ConnectionsService,
    @Inject(ACCOUNT_DELETE_QUEUE) private readonly deleteQueue: Queue<AccountDeleteJobData>,
  ) {}

  /** Build a JSON export of the account's memory and upload it (presigned). */
  async export(userId: string): Promise<{ jobId: string }> {
    const job = await this.jobs.create(userId, 'account_export');
    try {
      const areas = await this.prisma.space.findMany({ where: { ownerUserId: userId } });
      const memories = await this.vectors.scroll(P.own(userId, { includeSuperseded: true }), { limit: 10_000 });
      const payload = {
        exportedAt: new Date().toISOString(),
        areas: areas.map((a) => ({ id: a.id, name: a.name, path: a.path })),
        memories: memories.points.map((p) => ({ id: p.id, ...p.payload })),
      };
      let resultRef: string | null = null;
      if (this.s3.enabled) {
        const key = `users/${userId}/exports/${job.id}.json`;
        await this.s3.putObject(key, Buffer.from(JSON.stringify(payload)), 'application/json');
        resultRef = await this.s3.presignDownload(key);
      } else {
        resultRef = JSON.stringify(payload).slice(0, 1_000_000);
      }
      await this.jobs.update(job.id, { status: 'done', progress: 100, resultRef });
    } catch (err) {
      await this.jobs.update(job.id, { status: 'failed', error: (err as Error).message.slice(0, 500) });
    }
    return { jobId: job.id };
  }

  /** Enqueue account deletion — runs async in the worker process, see AccountDeleteWorker. */
  async requestDelete(userId: string): Promise<{ jobId: string }> {
    const job = await this.jobs.create(userId, 'account_delete');
    await this.deleteQueue.add('delete', { dbJobId: job.id, userId }, { jobId: `account_delete:${job.id}` });
    return { jobId: job.id };
  }

  /** Irreversibly delete the account across every store. Invoked by AccountDeleteWorker. */
  async delete(userId: string): Promise<{ status: string }> {
    await this.transferOrCloseSoleAdminGroups(userId);

    // MCP token resolution is cached 60s (grants.cache.ts) keyed by tokenLookup —
    // without this, a still-cached connection could keep "resolving" against a
    // just-deleted account for up to a minute, never hitting Postgres to notice
    // the Connection row (and the user) is gone.
    await this.connections.invalidateAllForUser(userId);

    // Qdrant: memories + entity store, both partitioned by user_id. includeSuperseded:
    // a full account purge must take superseded points too.
    await this.vectors
      .deleteByPredicate(P.own(userId, { includeSuperseded: true }))
      .catch((e) => this.logger.warn(`qdrant purge: ${e.message}`));
    await this.qdrant.client
      .delete(this.qdrant.entityCollectionName, { filter: { must: [{ key: 'user_id', match: { value: userId } }] } })
      .catch(() => null);

    // S3: everything under the user's prefix.
    await this.s3.deletePrefix(`users/${userId}/`).catch((e) => this.logger.warn(`s3 purge: ${e.message}`));

    // Postgres: delete memories first (MemoryArea.space is onDelete:Restrict; deleting
    // MemoryIndex cascades its MemoryArea rows away), then cascade from User (spaces,
    // connections, lenses, sessions, fragments, …) without tripping the Restrict.
    await this.prisma.memoryIndex.deleteMany({ where: { authorUserId: userId } });
    // File.spaceId is also onDelete:Restrict now (was Cascade): User → Space cascade can
    // no longer sweep away File rows for this user, so delete them explicitly. Their S3
    // objects are already gone — deletePrefix('users/${userId}/') above covers them
    // (s3Key = users/{userId}/spaces/{areaId}/...), so this is pure Postgres cleanup.
    await this.prisma.file.deleteMany({ where: { uploaderUserId: userId } });
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`account ${userId} deleted (postgres + qdrant + s3 + entity store)`);
    return { status: 'completed' };
  }

  /** Same invariant as leave()/removeMember(): a group never ends up adminless.
   *  The deleting user's GroupMember row hasn't been cascaded away yet at this
   *  point, so it's excluded explicitly rather than pre-deleted. */
  private async transferOrCloseSoleAdminGroups(userId: string): Promise<void> {
    const adminMemberships = await this.prisma.groupMember.findMany({
      where: { userId, role: 'admin' },
      select: { groupId: true },
    });
    for (const { groupId } of adminMemberships) {
      await this.collective.ensureAdminOrClose(groupId, userId);
    }
  }
}

@Controller('account')
class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('export')
  export(@CurrentUser() user: JwtPayload) {
    return this.account.export(user.sub);
  }

  @Post('delete')
  delete(@CurrentUser() user: JwtPayload) {
    return this.account.requestDelete(user.sub);
  }
}

@Module({
  imports: [FilesModule, JobsModule, CollectiveModule, ConnectionsModule],
  controllers: [AccountController],
  providers: [AccountService, accountDeleteQueueProvider],
  exports: [AccountService],
})
export class AccountModule {}
