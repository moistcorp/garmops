import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const appOutput = join(projectRoot, '.next', 'server', 'app')
const publicRoot = join(projectRoot, 'public')
const canonicalOrigin = 'https://www.garmops.com'
const privatePages = [
  { route: 'cart', metadataSource: 'src/app/cart/layout.tsx' },
  { route: 'checkout', metadataSource: 'src/app/checkout/layout.tsx' },
  { route: 'payment/failure', metadataSource: 'src/app/payment/layout.tsx' },
]
const noIndexHeaderRoutes = [
  '/api/:path*',
  '/cart',
  '/checkout',
  '/payment/:path*',
  '/configurator/build/:path*',
  '/configurator/cart/:path*',
]
const requiredCommercialPages = [
  '/custom-t-shirt-printing',
  '/custom-polo-t-shirts',
  '/custom-hoodies',
  '/custom-tote-bags',
  '/corporate-merchandise',
  '/industries/hospitality',
  '/industries/events',
]

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function exitOnFailures() {
  if (failures.length === 0) return

  console.error(`SEO check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

function readRequired(path) {
  check(existsSync(path), `Missing build artifact: ${path}`)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
}

function readJsonRequired(path, fallback) {
  const source = readRequired(path)
  if (!source) return fallback

  try {
    return JSON.parse(source)
  } catch {
    failures.push(`Invalid JSON build artifact: ${path}`)
    return fallback
  }
}

function htmlPathFor(url) {
  const pathname = new URL(url).pathname
  return pathname === '/'
    ? join(appOutput, 'index.html')
    : join(appOutput, `${pathname.slice(1)}.html`)
}

function imageFormatMatches(pathname) {
  const path = join(publicRoot, pathname.slice(1))
  if (!existsSync(path)) return false

  const bytes = readFileSync(path)
  const extension = extname(pathname).toLowerCase()

  if (extension === '.webp') {
    return bytes.subarray(0, 4).toString('ascii') === 'RIFF'
      && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }

  if (extension === '.jpg' || extension === '.jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8
  }

  if (extension === '.png') {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  }

  return true
}

function publicFiles(directory = publicRoot) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? publicFiles(path) : [path]
  })
}

check(existsSync(appOutput), 'Run `npm run build` before `npm run seo:check`.')
exitOnFailures()

const routesManifest = readJsonRequired(
  join(projectRoot, '.next', 'routes-manifest.json'),
  { redirects: [], headers: [] },
)
exitOnFailures()
const canonicalHostRedirect = routesManifest.redirects.find((redirect) =>
  redirect.has?.some((condition) =>
    condition.type === 'host' && condition.value === 'garmops.com'
  )
)
check(
  canonicalHostRedirect?.statusCode === 308
    && canonicalHostRedirect.destination === `${canonicalOrigin}/:path*`,
  'The apex domain does not permanently redirect to the canonical www host.',
)

for (const route of noIndexHeaderRoutes) {
  const rule = routesManifest.headers.find((header) => header.source === route)
  check(
    rule?.headers.some((header) =>
      header.key.toLowerCase() === 'x-robots-tag'
      && header.value === 'noindex, nofollow, noarchive'
    ),
    `Missing X-Robots-Tag protection for ${route}`,
  )
}

const robotsSource = existsSync(join(publicRoot, 'robots.txt'))
  ? join(publicRoot, 'robots.txt')
  : join(appOutput, 'robots.txt.body')
const robots = readRequired(robotsSource)
check(/User-agent:\s*\*/i.test(robots), 'robots.txt is missing the default crawler group.')
check(robots.includes('Allow: /'), 'robots.txt does not allow public crawling.')
check(
  robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
  'robots.txt does not advertise the canonical sitemap.',
)
check(
  robots.includes('Content-Signal: ai-train=no, search=yes, ai-input=yes'),
  'robots.txt does not declare the intended AI content-use policy.',
)

const sitemap = readRequired(join(appOutput, 'sitemap.xml.body'))
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)
const imageUrls = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)]
  .map(([, url]) => url)

check(urls.length > 0, 'sitemap.xml does not contain any URLs.')
check(new Set(urls).size === urls.length, 'sitemap.xml contains duplicate URLs.')

for (const url of urls) {
  check(url.startsWith(canonicalOrigin), `Non-canonical sitemap URL: ${url}`)
  check(!url.includes('?'), `Sitemap URL contains a query string: ${url}`)

  const html = readRequired(htmlPathFor(url))
  check(
    html.includes(`<link rel="canonical" href="${url}"/>`),
    `Missing or mismatched canonical link: ${url}`,
  )
  check(
    html.includes('<meta name="robots" content="index, follow"/>'),
    `Indexable sitemap page does not declare index, follow: ${url}`,
  )
}

for (const route of requiredCommercialPages) {
  const url = `${canonicalOrigin}${route}`
  const htmlPath = htmlPathFor(url)
  check(existsSync(htmlPath), `Required commercial page was not built: ${route}`)
  check(urls.includes(url), `Required commercial page is missing from the sitemap: ${route}`)

  const html = readRequired(htmlPath)
  check(
    html.includes(`<link rel="canonical" href="${url}"/>`),
    `Required commercial page has a missing or mismatched canonical: ${route}`,
  )
  check(
    html.includes('<meta name="robots" content="index, follow"/>'),
    `Required commercial page is not explicitly index, follow: ${route}`,
  )
  check(
    (html.match(/<h1(?:\s|>)/gi) ?? []).length === 1,
    `Required commercial page must contain exactly one H1: ${route}`,
  )
  check(
    html.includes('type="application/ld+json"'),
    `Required commercial page is missing JSON-LD: ${route}`,
  )
  check(
    html.includes('BreadcrumbList'),
    `Required commercial page is missing breadcrumb structured data: ${route}`,
  )
  check(
    /href="\/(?:configurator|contact)"/.test(html),
    `Required commercial page has no configurator or contact link: ${route}`,
  )
  check(
    !/\b(?:TODO|Lorem ipsum|Coming soon)\b/i.test(html),
    `Required commercial page contains placeholder copy: ${route}`,
  )
}

const indexableMetadata = urls.map((url) => {
  const html = readRequired(htmlPathFor(url))
  return {
    url,
    title: html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? '',
    description: html.match(/<meta name="description" content="([^"]*)"/i)?.[1]?.trim() ?? '',
  }
})

const titleOwners = new Map()
const descriptionOwners = new Map()
for (const page of indexableMetadata) {
  check(Boolean(page.title), `Indexable page is missing a title: ${page.url}`)
  check(Boolean(page.description), `Indexable page is missing a meta description: ${page.url}`)

  if (page.title) {
    const existing = titleOwners.get(page.title)
    check(!existing, `Duplicate indexable title on ${existing} and ${page.url}: ${page.title}`)
    titleOwners.set(page.title, page.url)
  }
  if (page.description) {
    const existing = descriptionOwners.get(page.description)
    check(!existing, `Duplicate indexable meta description on ${existing} and ${page.url}`)
    descriptionOwners.set(page.description, page.url)
  }
}

const internalLinkSources = [
  readRequired(join(appOutput, 'index.html')),
  readRequired(join(appOutput, 'products.html')),
]
for (const route of requiredCommercialPages) {
  check(
    internalLinkSources.some(html => html.includes(`href="${route}"`)),
    `Required commercial page is not linked from the homepage, navigation, footer, or products page: ${route}`,
  )
}

for (const url of imageUrls) {
  const { origin, pathname } = new URL(url)
  check(origin === canonicalOrigin, `Non-canonical image URL: ${url}`)
  check(existsSync(join(publicRoot, pathname.slice(1))), `Missing sitemap image: ${url}`)
  check(imageFormatMatches(pathname), `Image extension does not match its bytes: ${url}`)
}

for (const path of publicFiles()) {
  const extension = extname(path).toLowerCase()
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) continue

  const pathname = `/${path.slice(publicRoot.length + 1)}`
  check(imageFormatMatches(pathname), `Public image extension does not match its bytes: ${pathname}`)
}

for (const { route, metadataSource } of privatePages) {
  const htmlPath = join(appOutput, `${route}.html`)
  if (existsSync(htmlPath)) {
    const html = readRequired(htmlPath)
    check(
      html.includes('<meta name="robots" content="noindex, nofollow, nocache"/>'),
      `Private route is missing noindex metadata: /${route}`,
    )
    continue
  }

  const source = readRequired(join(projectRoot, metadataSource))
  check(
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*nocache:\s*true\s*\}/s.test(source),
    `Dynamic private route is missing noindex metadata in ${metadataSource}: /${route}`,
  )
}

exitOnFailures()

console.log(
  `SEO check passed: ${urls.length} canonical pages, ${requiredCommercialPages.length} required commercial pages, `
  + `${imageUrls.length} sitemap images, ${noIndexHeaderRoutes.length} protected route patterns, unique indexable metadata, and valid robots.txt.`,
)
