import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://api.fontshare.com",
              "font-src 'self' https://cdn.fontshare.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://api.resend.com https://formspree.io https://secure.payu.in https://test.payu.in",
              "frame-src https://secure.payu.in https://test.payu.in",
              "form-action 'self' https://secure.payu.in https://test.payu.in",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
