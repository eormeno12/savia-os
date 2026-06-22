import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';

const PRESIGN_EXPIRES_IN = 300; // 5 min

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: ConfigService) {
    this.client = new S3Client({ region: config.get<string>('AWS_REGION', 'us-east-1') });
    this.bucket = config.get<string>('AWS_S3_BUCKET', '');
  }

  async presignUpload(
    s3Key: string,
    mimeType: string,
    maxBytes: number,
  ): Promise<{ url: string; fields: Record<string, string> }> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: s3Key,
      Conditions: [
        ['content-length-range', 1, maxBytes],
        ['eq', '$Content-Type', mimeType],
      ],
      Fields: { 'Content-Type': mimeType },
      Expires: PRESIGN_EXPIRES_IN,
    });
    return { url, fields };
  }

  async deleteObject(s3Key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
  }
}
