import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ZodValidationPipe());

  const port = parseInt(process.env.API_PORT ?? '4400', 10);
  await app.listen(port, '127.0.0.1');
  console.log(`API running on http://127.0.0.1:${port}`);
}

bootstrap();
