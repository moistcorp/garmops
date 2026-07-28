import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

function read(path) {
  const absolutePath = join(root, path)
  check(existsSync(absolutePath), `Missing ${path}`)
  return existsSync(absolutePath) ? readFileSync(absolutePath) : Buffer.alloc(0)
}

const robots = read('public/robots.txt').toString('utf8')
check(/User-agent:\s*\*/i.test(robots), 'robots.txt does not define a default crawler group.')
check(robots.includes('OAI-SearchBot'), 'robots.txt does not explicitly address AI search crawlers.')
check(
  robots.includes('Content-Signal: ai-train=no, search=yes, ai-input=yes'),
  'robots.txt is missing the expected Content-Signal policy.',
)
check(
  robots.includes('Sitemap: https://www.garmops.com/sitemap.xml'),
  'robots.txt does not advertise the canonical sitemap.',
)

const llms = read('public/llms.txt').toString('utf8')
check(llms.includes('https://www.garmops.com/index.md'), 'llms.txt does not link to Markdown content.')
check(llms.includes('/.well-known/agent-skills/'), 'llms.txt does not advertise the public skill.')
check(read('public/llms-full.txt').length > 0, 'llms-full.txt is empty.')

const proxy = read('src/proxy.ts').toString('utf8')
check(proxy.includes("includes('text/markdown')"), 'Proxy does not negotiate text/markdown.')
check(proxy.includes('rel="alternate"'), 'Proxy does not advertise Markdown alternatives.')
check(proxy.includes('rel="agent-skills"'), 'Proxy does not advertise Agent Skill discovery.')
check(proxy.includes("requestHeaders.set('x-garmops-agent-source', sourcePath)"), 'Proxy does not preserve the requested source page.')

const route = read('src/app/agent-content/markdown/route.ts').toString('utf8')
check(route.includes("'Content-Type': 'text/markdown; charset=utf-8'"), 'Markdown route has the wrong content type.')
check(route.includes("'X-Robots-Tag': 'noindex, follow'"), 'Markdown fallback is missing duplicate-index protection.')
check(route.includes("request.headers.get('x-garmops-agent-source')"), 'Markdown route does not read the rewritten source page.')

const indexBuffer = read('public/.well-known/agent-skills/index.json')
let skillIndex
try {
  skillIndex = JSON.parse(indexBuffer.toString('utf8'))
} catch {
  failures.push('Agent Skill discovery index is not valid JSON.')
}

check(
  skillIndex?.$schema === 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  'Agent Skill index does not use the expected discovery schema.',
)
check(Array.isArray(skillIndex?.skills) && skillIndex.skills.length > 0, 'Agent Skill index has no skills.')

for (const skill of skillIndex?.skills ?? []) {
  check(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name), `Invalid Agent Skill name: ${skill.name}`)
  check(skill.type === 'skill-md', `Unsupported Agent Skill type for ${skill.name}.`)
  check(typeof skill.description === 'string' && skill.description.length > 0, `Missing description for ${skill.name}.`)
  check(typeof skill.url === 'string' && skill.url.startsWith('/.well-known/agent-skills/'), `Invalid URL for ${skill.name}.`)

  const skillPath = `public${skill.url}`
  const skillBytes = read(skillPath)
  const digest = `sha256:${createHash('sha256').update(skillBytes).digest('hex')}`
  check(skill.digest === digest, `Digest mismatch for ${skill.name}: expected ${digest}.`)

  const skillText = skillBytes.toString('utf8')
  check(skillText.startsWith('---\n'), `${skill.name} has no YAML frontmatter.`)
  check(skillText.includes(`\nname: ${skill.name}\n`), `${skill.name} frontmatter name does not match the index.`)
  check(
    skillText.includes(`\ndescription: ${skill.description}\n`),
    `${skill.name} frontmatter description does not match the index.`,
  )
  check(skill.name.length <= 64, `${skill.name} exceeds the 64-character name limit.`)
  check(skill.description.length <= 1024, `${skill.name} exceeds the 1,024-character description limit.`)
  check(!/[<>]/.test(skill.description), `${skill.name} description contains an angle bracket.`)

  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ''
  const frontmatterKeys = [...frontmatter.matchAll(/^([a-zA-Z0-9-]+):/gm)]
    .map((match) => match[1])
  check(
    frontmatterKeys.every((key) => ['name', 'description'].includes(key)),
    `${skill.name} frontmatter contains unsupported fields.`,
  )
}

if (failures.length > 0) {
  console.error(`Agent-readiness check failed with ${failures.length} issue${failures.length === 1 ? '' : 's'}:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `Agent-readiness check passed: Markdown negotiation, discovery links, AI content policy, `
  + `llms.txt, and ${skillIndex.skills.length} integrity-verified Agent Skill.`,
)
