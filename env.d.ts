/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    FILES: R2Bucket;
    CONTENT_EDITOR_PREVIEW_TOKEN?: string;
  }
}
