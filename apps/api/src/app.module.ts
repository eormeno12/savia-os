import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './common/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { FilesModule } from './modules/files/files.module';
import { MemoryModule } from './modules/memory/memory.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    AuthModule,
    FilesModule,
    MemoryModule,
    IngestModule,
    SpacesModule,
    ConnectionsModule,
    OnboardingModule,
  ],
})
export class AppModule {}
