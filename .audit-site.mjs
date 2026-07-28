import fs from "node:fs/promises";

const BASE = "http://127.0.0.1:3000";
const DEBUG = "http://127.0.0.1:9222";
const OUTPUT_DIR = "/private/tmp/garmops-ui-audit";
const axeSource = await fs.readFile(
  new URL("./node_modules/axe-core/axe.js", import.meta.url),
  "utf8",
);

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const targets = await fetch(`${DEBUG}/json/list`).then((response) => response.json());
const pageTarget = targets.find(
  (target) => target.type === "page" && target.url.startsWith(BASE),
);

if (!pageTarget) {
  throw new Error("No local site page was found in the browser");
}

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
let messageId = 0;
const pending = new Map();
const listeners = new Map();

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }

  if (!message.method) return;
  for (const listener of listeners.get(message.method) ?? []) {
    listener(message.params ?? {});
  }
});

await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++messageId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

function on(method, listener) {
  const methodListeners = listeners.get(method) ?? [];
  methodListeners.push(listener);
  listeners.set(method, methodListeners);
  return () => {
    listeners.set(
      method,
      (listeners.get(method) ?? []).filter((item) => item !== listener),
    );
  };
}

function waitFor(method, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const remove = on(method, (params) => {
      clearTimeout(timeout);
      remove();
      resolve(params);
    });
    const timeout = setTimeout(() => {
      remove();
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
  });
}

async function evaluate(expression, awaitPromise = true) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ??
        result.exceptionDetails.text ??
        "Runtime evaluation failed",
    );
  }
  return result.result.value;
}

await Promise.all([
  send("Page.enable"),
  send("Runtime.enable"),
  send("Network.enable"),
  send("Log.enable"),
]);

const sitemap = await fetch(`${BASE}/sitemap.xml`).then((response) => response.text());
const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/garmops\.com([^<]*)<\/loc>/g)].map(
  (match) => match[1] || "/",
);
const extraPaths = [
  "/cart",
  "/checkout",
  "/payment/failure",
  "/payment/success",
  "/configurator/build/regular-fit-tee-200gsm",
  "/configurator/build/not-a-real-product",
  "/configurator/cart/audit-cart/review",
  "/configurator/cart/audit-cart/shipping",
  "/configurator/cart/audit-cart/confirmation",
  "/definitely-not-a-real-page",
];
const paths = [...new Set([...sitemapPaths, ...extraPaths])];
const screenshotPaths = new Set([
  "/",
  "/products",
  "/products/regular-fit-tee-200gsm",
  "/how-it-works",
  "/pricing",
  "/work",
  "/journal",
  "/contact",
  "/cart",
  "/checkout",
  "/configurator",
  "/payment/failure",
  "/definitely-not-a-real-page",
]);

const runtimeIssues = [];
let activePath = "/";

on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
  runtimeIssues.push({
    path: activePath,
    type: "exception",
    text:
      exceptionDetails.exception?.description ??
      exceptionDetails.text ??
      "Unhandled runtime exception",
  });
});

on("Log.entryAdded", ({ entry }) => {
  if (entry.level === "error" || entry.level === "warning") {
    runtimeIssues.push({
      path: activePath,
      type: `console-${entry.level}`,
      text: entry.text,
      url: entry.url,
    });
  }
});

on("Network.loadingFailed", (event) => {
  if (event.canceled || event.blockedReason === "inspector") return;
  runtimeIssues.push({
    path: activePath,
    type: "resource-failure",
    text: event.errorText,
    url: event.requestId,
  });
});

const viewports = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];
const results = [];
const discoveredLinks = new Set();

for (const viewport of viewports) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height,
  });
  await send("Emulation.setTouchEmulationEnabled", {
    enabled: viewport.mobile,
    maxTouchPoints: viewport.mobile ? 5 : 1,
  });

  for (const path of paths) {
    activePath = path;
    const beforeIssueCount = runtimeIssues.length;
    const loadPromise = waitFor("Page.loadEventFired").catch(() => null);
    const navigation = await send("Page.navigate", { url: `${BASE}${path}` });
    await loadPromise;
    await new Promise((resolve) => setTimeout(resolve, 800));

    const state = await evaluate(`(() => {
      const text = (element) =>
        (element.getAttribute("aria-label") || element.textContent || "").trim();
      const rect = (element) => {
        const value = element.getBoundingClientRect();
        return {
          width: Math.round(value.width),
          height: Math.round(value.height),
        };
      };
      const controls = [
        ...document.querySelectorAll(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
        )
      ];
      const smallTargets = controls
        .filter((element) => {
          const value = rect(element);
          return value.width > 0 && value.height > 0 &&
            (value.width < 24 || value.height < 24);
        })
        .slice(0, 30)
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          text: text(element).slice(0, 80),
          size: rect(element),
          html: element.outerHTML.slice(0, 180),
        }));
      const inputsWithoutNames = [
        ...document.querySelectorAll('input:not([type="hidden"]), select, textarea')
      ].filter((element) => {
        const id = element.id;
        return !element.getAttribute("aria-label") &&
          !element.getAttribute("aria-labelledby") &&
          !(id && document.querySelector('label[for="' + CSS.escape(id) + '"]')) &&
          !element.closest("label");
      }).map((element) => element.outerHTML.slice(0, 220));
      const emptyInteractiveNames = controls
        .filter((element) => !text(element))
        .map((element) => element.outerHTML.slice(0, 220));
      const images = [...document.images];
      const anchors = [...document.querySelectorAll("a[href]")].map((element) => ({
        href: element.href,
        text: text(element).slice(0, 120),
        target: element.target,
        rel: element.rel,
      }));
      return {
        requestedPath: ${JSON.stringify(path)},
        actualUrl: location.href,
        statusTitle: document.title,
        navigationError: ${JSON.stringify(navigation.errorText ?? "")},
        readyState: document.readyState,
        language: document.documentElement.lang,
        h1: [...document.querySelectorAll("h1")].map((element) =>
          (element.textContent || "").trim()
        ),
        headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map(
          (element) => ({
            level: Number(element.tagName.slice(1)),
            text: (element.textContent || "").trim().slice(0, 140),
          })
        ),
        bodyTextLength: (document.body.innerText || "").trim().length,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        overflowElements: [...document.querySelectorAll("body *")]
          .filter((element) => {
            const value = element.getBoundingClientRect();
            return value.right > document.documentElement.clientWidth + 1 ||
              value.left < -1;
          })
          .slice(0, 20)
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            className: typeof element.className === "string"
              ? element.className.slice(0, 180)
              : "",
            text: (element.textContent || "").trim().slice(0, 80),
            bounds: {
              left: Math.round(element.getBoundingClientRect().left),
              right: Math.round(element.getBoundingClientRect().right),
            },
          })),
        images: {
          total: images.length,
          missingAlt: images
            .filter((image) => !image.hasAttribute("alt"))
            .map((image) => image.outerHTML.slice(0, 220)),
          broken: images
            .filter((image) => image.complete && image.naturalWidth === 0)
            .map((image) => image.currentSrc || image.src),
        },
        emptyInteractiveNames,
        inputsWithoutNames,
        smallTargets,
        targetBlankWithoutRel: anchors.filter(
          (anchor) => anchor.target === "_blank" &&
            !/\\b(noopener|noreferrer)\\b/.test(anchor.rel)
        ),
        anchors,
      };
    })()`);

    for (const anchor of state.anchors) {
      try {
        const url = new URL(anchor.href);
        if (url.origin === BASE) discoveredLinks.add(url.pathname + url.search);
      } catch {
        // Ignore malformed links here; axe reports them separately.
      }
    }
    delete state.anchors;

    let axe = null;
    if (viewport.name === "desktop") {
      try {
        await evaluate(axeSource, false);
        axe = await evaluate(`axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
          },
          resultTypes: ["violations"]
        }).then((result) => result.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            html: node.html.slice(0, 300),
            failureSummary: node.failureSummary
          }))
        })))`);
      } catch (error) {
        axe = [{ id: "audit-error", impact: "unknown", help: error.message, nodes: [] }];
      }
    }

    const screenshot = screenshotPaths.has(path) ? "queued-separately" : null;

    results.push({
      viewport: viewport.name,
      path,
      ...state,
      axe,
      screenshot,
      runtimeIssues: runtimeIssues.slice(beforeIssueCount),
    });
    process.stdout.write(
      `${viewport.name.padEnd(7)} ${path.padEnd(52)} ` +
        `h1=${state.h1.length} overflow=${state.horizontalOverflow} ` +
        `axe=${axe?.length ?? "-"} errors=${runtimeIssues.length - beforeIssueCount}\n`,
    );
  }
}

const linkChecks = [];
for (const path of [...discoveredLinks].sort()) {
  if (path.startsWith("/api/")) continue;
  try {
    const response = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      headers: { "user-agent": "Garmops local UI audit" },
    });
    linkChecks.push({
      path,
      status: response.status,
      location: response.headers.get("location"),
    });
  } catch (error) {
    linkChecks.push({ path, status: 0, error: error.message });
  }
}

await fs.writeFile(
  `${OUTPUT_DIR}/results.json`,
  JSON.stringify({ generatedAt: new Date().toISOString(), results, linkChecks }, null, 2),
);

const summary = {
  routeChecks: results.length,
  screenshots: results.filter((result) => result.screenshot).length,
  horizontalOverflow: results
    .filter((result) => result.horizontalOverflow)
    .map((result) => `${result.viewport}:${result.path}`),
  missingOrMultipleH1: results
    .filter((result) => result.h1.length !== 1)
    .map((result) => `${result.viewport}:${result.path} (${result.h1.length})`),
  axeViolations: results
    .filter((result) => result.viewport === "desktop")
    .map((result) => ({
      path: result.path,
      count: result.axe?.length ?? 0,
      ids: result.axe?.map((violation) => violation.id) ?? [],
    }))
    .filter((result) => result.count > 0),
  runtimeIssueCount: runtimeIssues.length,
  deadInternalLinks: linkChecks.filter((link) => link.status >= 400 || link.status === 0),
};

console.log(JSON.stringify(summary, null, 2));
ws.close();
