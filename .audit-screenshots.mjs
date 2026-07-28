import fs from "node:fs/promises";

const BASE = "http://127.0.0.1:3000";
const DEBUG = "http://127.0.0.1:9222";
const OUTPUT_DIR = "/private/tmp/garmops-ui-audit";
const paths = [
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
];
const viewports = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
];

await fs.mkdir(OUTPUT_DIR, { recursive: true });

const targets = await fetch(`${DEBUG}/json/list`).then((response) => response.json());
const target = targets.find(
  (candidate) => candidate.type === "page" && candidate.url.startsWith(BASE),
);
if (!target) throw new Error("Local browser target not found");

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 0;
const pending = new Map();
const eventListeners = new Map();

ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  for (const listener of eventListeners.get(message.method) ?? []) {
    listener(message.params ?? {});
  }
});
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function waitFor(method, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const listeners = eventListeners.get(method) ?? [];
    const listener = (params) => {
      clearTimeout(timeout);
      eventListeners.set(
        method,
        (eventListeners.get(method) ?? []).filter((item) => item !== listener),
      );
      resolve(params);
    };
    listeners.push(listener);
    eventListeners.set(method, listeners);
    const timeout = setTimeout(() => {
      eventListeners.set(
        method,
        (eventListeners.get(method) ?? []).filter((item) => item !== listener),
      );
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
  });
}

await send("Page.enable");

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
    const loaded = waitFor("Page.loadEventFired").catch(() => null);
    await send("Page.navigate", { url: `${BASE}${path}` });
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const capture = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    const safeName = path === "/"
      ? "home"
      : path.slice(1).replaceAll("/", "--").replaceAll(/[^a-zA-Z0-9-]/g, "_");
    const output = `${OUTPUT_DIR}/${viewport.name}-${safeName}.png`;
    await fs.writeFile(output, Buffer.from(capture.data, "base64"));
    process.stdout.write(`${viewport.name} ${path} -> ${output}\n`);
  }
}

ws.close();
