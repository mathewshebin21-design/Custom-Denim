import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import type { HeadObjectResult, PutObjectParams, StorageService, StorageVisibility } from "./types";
import { emitStorageEvent } from "./types";

/**
 * S3-compatible object storage. Uses the AWS SDK v3's S3Client against a
 * configurable `endpoint`, which is what makes this work unmodified against
 * real AWS S3 (leave S3_ENDPOINT unset) or any S3-compatible provider
 * (Cloudflare R2, MinIO, DigitalOcean Spaces, Backblaze B2 — set
 * S3_ENDPOINT + S3_FORCE_PATH_STYLE as that provider's docs specify). No
 * provider-name branching exists anywhere in this file or its callers —
 * only endpoint/credential configuration differs.
 *
 * Two separate buckets (public/private), not per-object ACLs: several
 * S3-compatible providers (R2 included) don't support fine-grained
 * per-object ACLs the way legacy AWS S3 does, but every one of them
 * supports "this bucket is public, that one isn't" at the bucket level —
 * so that's the one visibility mechanism this adapter relies on.
 */

export type S3ProviderConfig = {
  region: string;
  endpoint?: string;
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
};

export function loadS3ConfigFromEnv(): S3ProviderConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required when STORAGE_PROVIDER=s3`);
    return value;
  };
  return {
    region: required("S3_REGION"),
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    publicBucket: required("S3_PUBLIC_BUCKET"),
    privateBucket: required("S3_PRIVATE_BUCKET"),
    publicBaseUrl: required("S3_PUBLIC_BASE_URL").replace(/\/$/, ""),
  };
}

export class S3StorageProvider implements StorageService {
  private client: S3Client;

  constructor(private config: S3ProviderConfig) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  private bucketFor(visibility: StorageVisibility): string {
    return visibility === "public" ? this.config.publicBucket : this.config.privateBucket;
  }

  async putObject(params: PutObjectParams): Promise<{ key: string }> {
    emitStorageEvent({ name: "storage.upload.started", key: params.key, visibility: params.visibility, provider: "s3" });
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketFor(params.visibility),
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
        }),
      );
      emitStorageEvent({
        name: "storage.upload.completed",
        key: params.key,
        visibility: params.visibility,
        provider: "s3",
        detail: { bytes: params.body.length },
      });
      return { key: params.key };
    } catch (err) {
      // Never rethrow the raw SDK error to a caller that might surface it to
      // a customer — it can carry request ids/endpoint details. Log the
      // detail server-side (never credentials — the SDK error object here
      // does not carry them) and throw a clean, generic error instead.
      console.error("[storage] S3 putObject failed", { key: params.key, error: err instanceof Error ? err.message : err });
      emitStorageEvent({ name: "storage.upload.failed", key: params.key, visibility: params.visibility, provider: "s3" });
      throw new Error("Storage upload failed");
    }
  }

  async getSignedUrl(key: string, visibility: StorageVisibility, expiresInSeconds = 900): Promise<string> {
    if (visibility === "public") return this.getPublicUrl(key);
    try {
      const url = await presign(
        this.client,
        new GetObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }),
        { expiresIn: expiresInSeconds },
      );
      emitStorageEvent({ name: "storage.signed_url.generated", key, visibility, provider: "s3", detail: { expiresInSeconds } });
      return url;
    } catch (err) {
      console.error("[storage] S3 getSignedUrl failed", { key, error: err instanceof Error ? err.message : err });
      throw new Error("Could not generate access URL");
    }
  }

  getPublicUrl(key: string): string {
    return `${this.config.publicBaseUrl}/${key}`;
  }

  async getObject(key: string, visibility: StorageVisibility): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }));
    const bytes = await result.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }

  async headObject(key: string, visibility: StorageVisibility): Promise<HeadObjectResult> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }));
      return { exists: true, size: result.ContentLength, contentType: result.ContentType };
    } catch {
      return { exists: false };
    }
  }

  async deleteObject(key: string, visibility: StorageVisibility): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketFor(visibility), Key: key }));
    emitStorageEvent({ name: "storage.delete.completed", key, visibility, provider: "s3" });
  }
}
