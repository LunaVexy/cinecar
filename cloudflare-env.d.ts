declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CINECAR_ADMIN_PIN?: string;
    BUCKET?: R2Bucket;
  }
}
