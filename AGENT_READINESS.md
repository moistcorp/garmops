# Garmops agent-readiness

Updated: 28 July 2026

## What the project now exposes

| Cloudflare check | Project implementation |
| --- | --- |
| Robots and AI crawler rules | `/robots.txt` allows public content, blocks private/internal routes, and addresses major AI search and assistant user agents. |
| Sitemap | `/sitemap.xml` lists canonical public pages and images. |
| Link discovery | Public HTML responses advertise a Markdown alternative, `llms.txt`, and the Agent Skill index. |
| Agent-readable content | Public pages respond to `Accept: text/markdown`; the same curated documents are available at `/index.md` and page-level `/index.md` URLs. |
| Content Signals | HTML, Markdown, and `robots.txt` declare `ai-train=no, search=yes, ai-input=yes`. |
| LLM reading map | `/llms.txt` and `/llms-full.txt` describe the company, catalogue, commercial facts, and useful reading paths. |
| Agent Skills | `/.well-known/agent-skills/index.json` publishes a SHA-256-verified `prepare-custom-apparel-brief` skill. |

The Markdown responses are generated from the same TypeScript catalogue, pricing,
journal, and case-study data used by the human site. This reduces stale duplicate
copy. Unknown product, journal, work, and Markdown URLs return a real 404.

## Deliberately not published

Garmops does not currently expose a public developer API, OAuth authorization
server, MCP server, A2A agent, WebMCP tools, or agent-commerce protocol. Empty
discovery documents would make the scan look better without giving an agent a
real, safe capability.

The PayU hash and callback handlers, checkout state, order drafts, and email
endpoints are private implementation details. They remain excluded from crawler
and agent discovery.

## Safe next capability phase

If autonomous interaction becomes a product requirement, build one bounded,
read-only capability first:

1. Create a versioned quote-estimate API for catalogue products and published
   price rules. Return an estimate, never a final quote.
2. Publish its OpenAPI document and RFC 9727 API Catalog only after the endpoint
   has validation, abuse limits, monitoring, and a stable support policy.
3. Add an MCP server card only when a real MCP server exposes equivalent
   read-only tools such as catalogue lookup and estimate generation.
4. Require explicit human confirmation and appropriate authorization before any
   tool creates a draft, uploads artwork, sends an enquiry, or changes an order.
5. Consider agent-commerce protocols only after payment, cancellation, refund,
   shipping, tax, inventory, and human-approval rules are defined for autonomous
   buyers.

OAuth discovery is relevant only if third-party agents can act on a signed-in
customer's behalf. Web Bot Auth is relevant when Garmops operates its own
outbound agent, not merely because the website serves content.

## Validation

After a production build:

```bash
npm run seo:check
npm run agent:check
```

After deployment, verify the real origin:

```bash
curl -I https://www.garmops.com/
curl -I -H 'Accept: text/markdown' https://www.garmops.com/
curl https://www.garmops.com/products/index.md
curl https://www.garmops.com/.well-known/agent-skills/index.json
curl https://www.garmops.com/robots.txt
```

Then rerun Cloudflare's scanner. A score increase is expected for Markdown
content, discovery links, Content Signals, and Agent Skills, but the exact score
depends on the scanner version and selected checks.

DNS-AID is an external DNS setting and should be added only when there is a
stable agent or capability endpoint to advertise.
