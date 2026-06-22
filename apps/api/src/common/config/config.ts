import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService extends NestConfigService {
  get apiPort(): number {
    return parseInt(this.get<string>('API_PORT', '4400'), 10);
  }

  get redisUrl(): string {
    return this.get<string>('REDIS_URL', 'redis://localhost:6379');
  }

  get qdrantUrl(): string {
    return this.get<string>('QDRANT_URL', 'http://localhost:6333');
  }
}
