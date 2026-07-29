import "server-only";

import {
  parseServerEnvironment,
  type ServerEnvironment,
} from "@/lib/config/envSchema";

export type { ServerEnvironment } from "@/lib/config/envSchema";

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
