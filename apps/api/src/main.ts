import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser') as () => ReturnType<typeof import('cookie-parser')>;
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());

  const allowedOrigins = [
    'http://127.0.0.1:4345',
    'http://localhost:4345',
    ...(process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : []),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = parseInt(process.env.API_PORT ?? '4400', 10);
  await app.listen(port, '127.0.0.1');
  console.log(`API running on http://127.0.0.1:${port}`);
}

bootstrap();
