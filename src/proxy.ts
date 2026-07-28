import { type NextRequest, NextResponse } from 'next/server'
import {
  isAgentReadablePath,
  markdownPathFor,
  normalizeAgentPath,
  sourcePathFromMarkdownPath,
} from '@/lib/agentRoutes'

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

export function proxy(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return NextResponse.next()
  }

  const pathname = normalizeAgentPath(request.nextUrl.pathname)
  const fallbackSource = sourcePathFromMarkdownPath(pathname)

  if (fallbackSource) {
    return markdownRewrite(request, fallbackSource)
  }

  if (!isAgentReadablePath(pathname)) {
    return NextResponse.next()
  }

  if (request.headers.get('accept')?.toLowerCase().includes('text/markdown')) {
    return markdownRewrite(request, pathname)
  }

  const response = NextResponse.next()
  response.headers.set('Content-Signal', CONTENT_SIGNAL)
  response.headers.set(
    'Link',
    [
      `<${markdownPathFor(pathname)}>; rel="alternate"; type="text/markdown"`,
      '</llms.txt>; rel="describedby"; type="text/plain"',
      '</.well-known/agent-skills/index.json>; rel="agent-skills"; type="application/json"',
    ].join(', '),
  )
  response.headers.set('Vary', 'Accept')
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|agent-content|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
