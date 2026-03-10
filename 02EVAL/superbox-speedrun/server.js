// SUPERBOX SYNC SERVER — SSE EDITION
// Run: node server.js
// No npm install needed — uses Node.js built-in http module
//
// One macbook runs this. Both macbooks connect to it.
// P2: find P1's local IP in System Settings > Network, then enter it in the app.
// Uses Server-Sent Events (SSE) — real-time push, no polling.

const http = require("http");
const os   = require("os");

let sharedState = { checked: {} };
let sseClients  = [];

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(msg); return true; }
    catch { return false; }
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  // ── GET /state  (initial snapshot) ──────────────────────────
  if (req.method === "GET" && req.url === "/state") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(sharedState));
    return;
  }

  // ── GET /events  (SSE stream) ────────────────────────────────
  if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    // send current state immediately on connect
    res.write(`data: ${JSON.stringify(sharedState)}\n\n`);
    sseClients.push(res);
    req.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
    return;
  }

  // ── POST /state  (push new state, broadcast to all SSE) ─────
  if (req.method === "POST" && req.url === "/state") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", () => {
      try {
        sharedState = JSON.parse(body);
        broadcast(sharedState);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400);
        res.end("Bad JSON");
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const localIPs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal)
        localIPs.push(`  ${name}: http://${net.address}:${PORT}`);
    }
  }
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   SUPERBOX SYNC SERVER — SSE READY       ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\nLocal:   http://localhost:${PORT}`);
  if (localIPs.length > 0) {
    console.log("\nFor P2 (other macbook), enter one of these:");
    localIPs.forEach(ip => console.log(ip));
  }
  console.log("\nReal-time push via SSE — no polling.");
  console.log("Keep this terminal open. Ctrl+C to stop.\n");
});
