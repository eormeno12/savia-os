import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AppConfig } from './common/config/app.config';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1); // behind Caddy/ALB — honor X-Forwarded-For for rate-limit/IP

  const config = app.get(AppConfig);

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: [
      'http://127.0.0.1:4345',
      'http://localhost:4345',
      ...(config.appOrigin ? [config.appOrigin] : []),
      ...config.corsOrigins,
    ],
    credentials: true,
  });
  app.enableShutdownHooks();

  await app.listen(config.apiPort, config.host);
  app.get(Logger).log(`API running on http://${config.host}:${config.apiPort}`);
}

void bootstrap();
