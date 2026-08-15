import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

function configuredOrigin(value: string | undefined) {
  if (!value) return undefined
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

const medusaOrigin = configuredOrigin(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)
const sentryOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SENTRY_DSN)
const isDevelopment = process.env.NODE_ENV === 'development'
const productionHeaders = process.env.NODE_ENV === 'production'
  ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
  : []

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'garmops.com' }],
        destination: 'https://www.garmops.com/:path*',
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
        source: '/garments/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...productionHeaders,
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com`,
              "style-src 'self' 'unsafe-inline' https://api.fontshare.com https://fonts.googleapis.com",
              "font-src 'self' https://cdn.fontshare.com https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              `connect-src 'self' https://secure.payu.in https://test.payu.in https://challenges.cloudflare.com${medusaOrigin ? ` ${medusaOrigin}` : ''}${sentryOrigin ? ` ${sentryOrigin}` : ''}`,
              "frame-src https://secure.payu.in https://test.payu.in https://challenges.cloudflare.com",
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
        source: '/account/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      },
      {
        source: '/staff/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        ],
      },
      {
        source: '/auth/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
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

export default withSentryConfig(nextConfig, {
  silent: true,
  sourcemaps: { disable: process.env.SENTRY_ENABLED !== 'true' },
})
