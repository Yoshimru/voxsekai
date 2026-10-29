const fs = require("node:fs");
const CDP_PORT = 9227;
const BASE = "http://127.0.0.1:3001";
const cookieLine = fs
  .readFileSync("profile-cookies.txt", "utf8")
  .split(/\r?\n/)
  .find((line) => line.includes("connect.sid"));
const cookieValue = cookieLine.split("\t").pop();
let nextId = 1;
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  return { ready, send, socket };
}
async function main() {
  const target = await (
    await fetch(
      `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" },
    )
  ).json();
  const { ready, send, socket } = connect(target.webSocketDebuggerUrl);
  await ready;
  await send("Network.enable");
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Network.setCookie", {
    name: "connect.sid",
    value: cookieValue,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  await send("Page.navigate", { url: `${BASE}/` });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem('voxsekai.favorites.v1', JSON.stringify(['track-1793292159007']))`,
  });
  await send("Page.navigate", { url: `${BASE}/profile` });
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const info = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      genres: document.querySelector('[data-profile-genres]')?.innerHTML,
      artists: document.querySelector('[data-profile-artists]')?.innerHTML,
      insights: document.querySelector('.profile-insights')?.getBoundingClientRect(),
      genrePanel: document.querySelector('.profile-genres')?.getBoundingClientRect(),
      artistPanel: document.querySelector('.profile-artists')?.getBoundingClientRect()
    })`,
    returnByValue: true,
  });
  console.log(info.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("profile-favorites-check.png", Buffer.from(shot.data, "base64"));
  socket.close();
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
