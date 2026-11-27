import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { RoomManager } from './src/server/roomManager.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.use(express.json());

  const roomManager = new RoomManager();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const summary = roomManager.getRoomSummary(req.params.code);
    res.json(summary);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  const aliveMap = new WeakMap<WebSocket, boolean>();

  wss.on('connection', (ws) => {
    aliveMap.set(ws, true);

    ws.on('pong', () => {
      aliveMap.set(ws, true);
    });

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      roomManager.handleMessage(ws, text);
    });

    ws.on('close', () => {
      roomManager.handleDisconnect(ws);
    });

    ws.on('error', () => {
      roomManager.handleDisconnect(ws);
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (aliveMap.get(client) === false) {
        client.terminate();
        continue;
      }
      aliveMap.set(client, false);
      client.ping();
    }
  }, 25_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    roomManager.dispose();
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Snakes & Ladders server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
