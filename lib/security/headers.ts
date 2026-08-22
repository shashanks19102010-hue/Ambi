export const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",

    value:
      "default-src 'self'; connect-src 'self' https:; img-src 'self' data: blob:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  },

  {
    key: "X-Content-Type-Options",
    value: "nosniff"
  },

  {
    key: "X-Frame-Options",
    value: "DENY"
  },

  {
    key: "Referrer-Policy",
    value:
      "strict-origin-when-cross-origin"
  },

  {
    key: "Permissions-Policy",

    value:
      "camera=(), microphone=(), geolocation=(), payment=()"
  },

  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin"
  },

  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin"
  }
];