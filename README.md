# 🚔 Police GPS Tracker

Real-time GPS tracking system for law enforcement.  
Built with Node.js, Socket.IO, Express, and Leaflet.js.

---

## Setup & Run

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```

The server runs on **http://localhost:3000**

---

## Usage

### Police Dashboard
Open: `http://localhost:3000/dashboard`  
Default password: **`police2024`**  
*(Change this in server.js → `POLICE_PASSWORD`)*

### Workflow
1. Open the dashboard and log in
2. Click **"+ New Link"** and enter the suspect's label
3. Copy the generated tracking URL
4. Send the URL to the target device (via SMS, WhatsApp, etc.)
5. When the target opens the link and taps **"Share My Location"**, their position appears on your map in real-time

---

## Features
- 🔴 Live marker with animated pulse
- 📍 Accuracy radius circle
- 🛤️ Movement trail (polyline)
- 👥 Multiple suspect tracking simultaneously
- 🔒 Password-protected dashboard
- 📡 Real-time updates via WebSockets (Socket.IO)
- 🗑️ Clear trail per session

---

## Change the Password
Edit `server.js`, line:
```js
const POLICE_PASSWORD = "police2024"; // ← change this
```

Or set it as an environment variable:
```bash
POLICE_PASSWORD=mysecretpassword npm start
```

---

## Deploy to Production
- Use **PM2** to keep the server running:  
  `npm install -g pm2 && pm2 start server.js`
- Put behind **Nginx** with HTTPS (required for geolocation on mobile)
- Recommended hosting: **Render**, **Railway**, **VPS (Contabo, Hetzner)**

> ⚠️ HTTPS is required for geolocation to work on most modern mobile browsers.
> Use Let's Encrypt (certbot) or a hosting provider that gives you free SSL.

---

## Stack
| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Real-time | Socket.IO (WebSockets) |
| Maps | Leaflet.js + OpenStreetMap |
| Frontend | Vanilla HTML/CSS/JS |
