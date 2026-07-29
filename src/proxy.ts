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

const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes'

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

export async function proxy(request: NextRequest) {
  const pathname = normalizeAgentPath(request.nextUrl.pathname)
  if (request.method === 'GET' || request.method === 'HEAD') {
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
    return copySessionHeaders(session.response, NextResponse.redirect(loginUrl))
  }

  if (
    (pathname === '/staff' || pathname.startsWith('/staff/')) &&
    !session.authenticated
  ) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('next', '/staff')
    return copySessionHeaders(session.response, NextResponse.redirect(loginUrl))
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

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|agent-content|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
