import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'garmops.com' }],
        destination: 'https://www.garmops.com/:path*',
        permanent: true,
      },
      {
        source: '/journal/screen-print-vs-dtg',
        destination: '/journal/screen-printing-vs-dtg-vs-dtf-embroidery',
        permanent: true,
      },
    ]
  },
  async headers() {
    const agentReadableHeaders = [
      '/',
      '/about',
      '/corporate-merchandise',
      '/configurator',
      '/contact',
      '/custom-hoodies',
      '/custom-polo-t-shirts',
      '/custom-t-shirt-printing',
      '/custom-tote-bags',
      '/how-it-works',
      '/industries/:path*',
      '/journal/:path*',
      '/pricing',
      '/products/:path*',
      '/work/:path*',
    ].map((source) => ({
      source,
      headers: [{ key: 'Vary', value: 'Accept' }],
    }))

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
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/cart',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/checkout',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/payment/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/configurator/build/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/configurator/cart/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/.well-known/agent-skills/index.json',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
        ],
      },
      {
        source: '/.well-known/agent-skills/:skill/SKILL.md',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
        ],
      },
      ...agentReadableHeaders,
    ]
  },
}

export default nextConfig
