import type { NextRequest } from 'next/server'
import { renderAgentMarkdown } from '@/lib/agentContent'
import { isAgentReadablePath } from '@/lib/agentRoutes'
import { absoluteUrl } from '@/lib/seo'

const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes'

function responseHeaders(pathname: string, markdown: string) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    'Content-Location': absoluteUrl(pathname),
    'Content-Signal': CONTENT_SIGNAL,
    'Content-Type': 'text/markdown; charset=utf-8',
    Link: `<${absoluteUrl(pathname)}>; rel="canonical"; type="text/html"`,
    Vary: 'Accept',
    'X-Markdown-Tokens': String(Math.ceil(markdown.length / 4)),
    'X-Robots-Tag': 'noindex, follow',
  }
}

export async function GET(request: NextRequest) {
  const pathname = request.headers.get('x-garmops-agent-source')
    ?? request.nextUrl.searchParams.get('path')
    ?? ''
  const markdown = isAgentReadablePath(pathname)
    ? renderAgentMarkdown(pathname)
    : null

  if (!markdown) {
    return new Response('# Not found\n', {
      status: 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    })
  }

  return new Response(markdown, {
    headers: responseHeaders(pathname, markdown),
  })
}
