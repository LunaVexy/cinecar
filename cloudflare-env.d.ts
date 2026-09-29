declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CINECAR_ADMIN_PIN?: string;
    EMAILJS_SERVICE_ID?: string;
    EMAILJS_TEMPLATE_ID?: string;
    EMAILJS_PUBLIC_KEY?: string;
    EMAILJS_PRIVATE_KEY?: string;
    BUCKET?: R2Bucket;
  }
}
