import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './common/config/env.schema';
import { LoggingModule } from './common/logging/logging.module';
import { InfraModule } from './common/infra/infra.module';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessModule } from './modules/access/access.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { MemoryModule } from './modules/memory/memory.module';
import { AreasModule } from './modules/areas/areas.module';
import { CollectiveModule } from './modules/collective/collective.module';
import { LensesModule } from './modules/lenses/lenses.module';
import { FilesModule } from './modules/files/files.module';
import { GrowthModule } from './modules/growth/growth.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { AccountModule } from './modules/account/account.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BillingModule } from './modules/billing/billing.module';

/**
 * Root HTTP module. Feature modules are added as each phase rebuilds them:
 *   FASE-2 memory · FASE-3 areas · FASE-5 collective
 *   FASE-6 files/growth/onboarding/account/inbox/lenses · FASE-7 billing
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    LoggingModule,
    InfraModule,
    HealthModule,
    AuthModule,
    AccessModule,
    ConnectionsModule,
    AreasModule,
    MemoryModule,
    CollectiveModule,
    LensesModule,
    FilesModule,
    GrowthModule,
    InboxModule,
    AccountModule,
    OnboardingModule,
    BillingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
