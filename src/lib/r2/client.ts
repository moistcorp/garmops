import "server-only";

import { S3Client } from "@aws-sdk/client-s3";

import { getServerEnvironment } from "@/lib/config/env";

let cachedClient: S3Client | undefined;

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;

  const environment = getServerEnvironment();
  if (
    !environment.R2_S3_ENDPOINT ||
    !environment.R2_ACCESS_KEY_ID ||
    !environment.R2_SECRET_ACCESS_KEY
  ) {
    throw new Error("R2 client configuration is unavailable");
  }

  cachedClient = new S3Client({
    region: "auto",
    endpoint: environment.R2_S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
  });

  return cachedClient;
}

export function getPrivateBucketName(): "garmops-private-orders" {
  const bucket = getServerEnvironment().R2_PRIVATE_BUCKET;
  if (bucket !== "garmops-private-orders") {
    throw new Error("Private R2 bucket configuration is unavailable");
  }
  return bucket;
}
