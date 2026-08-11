import { Injectable } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppConfig } from '../../common/config/app.config';

const PRESIGN_EXPIRES_IN = 300;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(config: AppConfig) {
    this.client = new S3Client({ region: config.awsRegion ?? 'us-east-1' });
    this.bucket = config.s3Bucket ?? '';
  }

  get enabled(): boolean {
    // Require credentials too — otherwise the SDK blocks for minutes probing IMDS.
    return this.bucket.length > 0 && !!process.env.AWS_ACCESS_KEY_ID;
  }

  async presignUpload(s3Key: string, mimeType: string, maxBytes: number) {
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

  async download(s3Key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async putObject(s3Key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: s3Key, Body: body, ContentType: contentType }));
  }

  async presignDownload(s3Key: string, expiresIn = PRESIGN_EXPIRES_IN): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: s3Key }), { expiresIn });
  }

  async deleteObject(s3Key: string): Promise<void> {
    if (!this.enabled) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
  }

  /** Purge every object under a prefix (account deletion). */
  async deletePrefix(prefix: string): Promise<void> {
    if (!this.enabled) return;
    let token: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (listed.Contents ?? []).map((o) => ({ Key: o.Key! })).filter((k) => k.Key);
      if (keys.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }));
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
  }
}
