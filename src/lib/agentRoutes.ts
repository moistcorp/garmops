const STATIC_AGENT_PATHS = new Set([
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
  '/industries/events',
  '/industries/hospitality',
  '/journal',
  '/pricing',
  '/products',
  '/work',
])

const DYNAMIC_AGENT_SECTIONS = new Set(['journal', 'products', 'work'])
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeAgentPath(pathname: string) {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

export function isAgentReadablePath(pathname: string) {
  if (!pathname) return false

  const normalized = normalizeAgentPath(pathname)
  if (STATIC_AGENT_PATHS.has(normalized)) return true

  const segments = normalized.split('/').filter(Boolean)
  return segments.length === 2
    && DYNAMIC_AGENT_SECTIONS.has(segments[0])
    && SAFE_SLUG.test(segments[1])
}

export function markdownPathFor(pathname: string) {
  const normalized = normalizeAgentPath(pathname)
  return normalized === '/' ? '/index.md' : `${normalized}/index.md`
}

export function sourcePathFromMarkdownPath(pathname: string) {
  if (!pathname) return null

  const normalized = normalizeAgentPath(pathname)
  if (normalized === '/index.md') return '/'
  if (!normalized.endsWith('/index.md')) return null

  const sourcePath = normalizeAgentPath(normalized.slice(0, -'/index.md'.length))
  return isAgentReadablePath(sourcePath) ? sourcePath : null
}
