import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { validateEnv } from '../common/config/env.schema';
import { LoggingModule } from '../common/logging/logging.module';
import { InfraModule } from '../common/infra/infra.module';
import { OrganizationModule } from '../modules/organization/organization.module';
import { EngineBootstrapService } from '../modules/organization/bootstrap/engine-bootstrap.service';

/**
 * One-shot "clean bootstrap" of the v2 engine over existing data. Run with the API
 * + worker stopped (or right after the v2 deploy):
 *   pnpm --filter @savia-os/api engine:bootstrap          # all users
 *   pnpm --filter @savia-os/api engine:bootstrap <userId> # a single user
 * Idempotent — safe to re-run.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    InfraModule,
    OrganizationModule,
  ],
})
class BootstrapModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BootstrapModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const log = app.get(Logger);
  const bootstrap = app.get(EngineBootstrapService);

  const userId = process.argv[2];
  try {
    if (userId) {
      log.log(`engine bootstrap: single user ${userId}`);
      await bootstrap.bootstrapUser(userId);
    } else {
      log.log('engine bootstrap: all users');
      await bootstrap.bootstrapAll();
    }
    log.log('engine bootstrap complete');
    await app.close();
    process.exit(0);
  } catch (err) {
    log.error(`engine bootstrap failed: ${(err as Error).message}`);
    await app.close();
    process.exit(1);
  }
}

void main();
