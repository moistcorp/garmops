import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import process from 'node:process'

const projectRoot = process.cwd()
const appOutput = join(projectRoot, '.next', 'server', 'app')
const publicRoot = join(projectRoot, 'public')
const canonicalOrigin = 'https://www.garmops.com'
const privatePages = ['cart', 'checkout', 'payment/failure']
const noIndexHeaderRoutes = [
  '/api/:path*',
  '/cart',
  '/checkout',
  '/payment/:path*',
  '/configurator/build/:path*',
  '/configurator/cart/:path*',
]

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function readRequired(path) {
  check(existsSync(path), `Missing build artifact: ${path}`)
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
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

const routesManifest = JSON.parse(
  readRequired(join(projectRoot, '.next', 'routes-manifest.json')),
)
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

for (const route of privatePages) {
  const html = readRequired(join(appOutput, `${route}.html`))
  check(
    html.includes('<meta name="robots" content="noindex, nofollow, nocache"/>'),
    `Private route is missing noindex metadata: /${route}`,
  )
}

if (failures.length > 0) {
  console.error(`SEO check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `SEO check passed: ${urls.length} canonical pages, ${imageUrls.length} sitemap images, `
  + `${noIndexHeaderRoutes.length} protected route patterns, and valid robots.txt.`,
)
