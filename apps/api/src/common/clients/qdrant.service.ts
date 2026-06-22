import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

@Injectable()
export class QdrantService extends QdrantClient {
  readonly baseUrl: string;

  constructor(config: ConfigService) {
    const url = config.get<string>('QDRANT_URL', 'http://localhost:6333');
    super({ url });
    this.baseUrl = url;
  }
}
