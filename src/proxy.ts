import { type NextRequest, NextResponse } from 'next/server'
import {
  isAgentReadablePath,
  markdownPathFor,
  normalizeAgentPath,
  sourcePathFromMarkdownPath,
} from '@/lib/agentRoutes'
import {
  copySessionHeaders,
  refreshSupabaseSession,
} from '@/lib/supabase/proxy'
import {
  isStaffSurface,
  staffAppUrl,
} from '@/lib/config/appSurface'
import { requestIdFrom, withRequestId } from '@/lib/http/requestId'

const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes'
const STAFF_AUTH_PATHS = new Set([
  '/login',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/auth/error',
])
const STAFF_API_PREFIXES = [
  '/api/uploads',
  '/api/files',
  '/api/internal',
  '/api/health',
]

const STAFF_PORTAL_PREFIXES = [
  '/orders',
  '/artwork-review',
  '/payments',
  '/quotes',
  '/discounts',
  '/staff-management',
  '/settings',
]
const PUBLIC_ASSET_PATH = /\.(?:avif|gif|ico|jpe?g|png|svg|webp|woff2?|webmanifest)$/i

function markdownRewrite(request: NextRequest, sourcePath: string) {
  const destination = request.nextUrl.clone()
  destination.pathname = '/agent-content/markdown'
  destination.search = ''

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-garmops-agent-source', sourcePath)

  const response = NextResponse.rewrite(destination, {
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Signal', CONTENT_SIGNAL)
  response.headers.set('Vary', 'Accept')
  return response
}

function staffPathFromLegacy(pathname: string): string {
  if (pathname === '/staff' || pathname === '/staff/') return '/orders'
  if (pathname === '/staff/login') return '/login'
  if (pathname.startsWith('/staff/orders')) {
    return pathname.slice('/staff'.length) || '/orders'
  }
  return '/orders'
}

function isStaffPortalPath(pathname: string): boolean {
  return STAFF_PORTAL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isPublicAssetPath(pathname: string): boolean {
  return PUBLIC_ASSET_PATH.test(pathname)
}

function redirectWithSession(
  sessionResponse: NextResponse,
  destination: URL,
) {
  return copySessionHeaders(
    sessionResponse,
    NextResponse.redirect(destination),
  )
}

async function routeRequest(request: NextRequest) {
  const pathname = normalizeAgentPath(request.nextUrl.pathname)
  const staffSurface = isStaffSurface()

  if (!staffSurface && (request.method === 'GET' || request.method === 'HEAD')) {
    const fallbackSource = sourcePathFromMarkdownPath(pathname)

    if (fallbackSource) {
      return markdownRewrite(request, fallbackSource)
    }

    if (
      isAgentReadablePath(pathname) &&
      request.headers.get('accept')?.toLowerCase().includes('text/markdown')
    ) {
      return markdownRewrite(request, pathname)
    }
  }

  const session = await refreshSupabaseSession(request)

  if (staffSurface) {
    if (pathname.startsWith('/staff')) {
      const destination = request.nextUrl.clone()
      destination.pathname = staffPathFromLegacy(pathname)
      destination.search = request.nextUrl.search
      return redirectWithSession(session.response, destination)
    }

    if (pathname === '/') {
      const destination = request.nextUrl.clone()
      destination.pathname = session.authenticated ? '/orders' : '/login'
      destination.search = ''
      return redirectWithSession(session.response, destination)
    }

    if (
      !session.authenticated &&
      isStaffPortalPath(pathname)
    ) {
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.search = ''
      loginUrl.searchParams.set(
        'next',
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      )
      return redirectWithSession(session.response, loginUrl)
    }

    if (pathname.startsWith('/api/') && !STAFF_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return NextResponse.json({ error: 'Route is unavailable on the Foundry deployment' }, { status: 404 })
    }

    // The Foundry deployment is intentionally not a second public storefront.
    // Unknown GET/HEAD paths are sent to the operations root instead of exposing
    // customer or marketing screens under foundry.garmops.com.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      !STAFF_AUTH_PATHS.has(pathname) &&
      !isStaffPortalPath(pathname) &&
      !isPublicAssetPath(pathname) &&
      !pathname.startsWith('/api/') &&
      !pathname.startsWith('/payment/')
    ) {
      const destination = request.nextUrl.clone()
      destination.pathname = session.authenticated ? '/orders' : '/login'
      destination.search = ''
      return redirectWithSession(session.response, destination)
    }

    return session.response
  }

  if (
    pathname.startsWith('/staff') ||
    isStaffPortalPath(pathname)
  ) {
    const destination = new URL(
      pathname.startsWith('/staff')
        ? staffPathFromLegacy(pathname)
        : pathname,
      staffAppUrl(),
    )
    destination.search = request.nextUrl.search
    return redirectWithSession(session.response, destination)
  }

  if (
    (pathname === '/account' || pathname.startsWith('/account/')) &&
    !session.authenticated
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set(
      'next',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    )
    return redirectWithSession(session.response, loginUrl)
  }

  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    isAgentReadablePath(pathname)
  ) {
    session.response.headers.set('Content-Signal', CONTENT_SIGNAL)
    session.response.headers.set(
      'Link',
      [
        `<${markdownPathFor(pathname)}>; rel="alternate"; type="text/markdown"`,
        '</llms.txt>; rel="describedby"; type="text/plain"',
        '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
      ].join(', '),
    )
    session.response.headers.set('Vary', 'Accept')
  }

  return session.response
}

export async function proxy(request: NextRequest) {
  return withRequestId(await routeRequest(request), requestIdFrom(request))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
