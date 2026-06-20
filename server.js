// Ligação Local — chamada de voz pela rede de casa, sem internet.
// Servidor HTTPS que entrega a página e faz a sinalização WebRTC entre dois
// participantes via long-polling (sem dependências de npm).

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PORT = Number(process.env.PORT) || 8443;
// --http: modo de teste sem certificado. O navegador só libera o microfone
// em http://localhost, então para uso real (celular) é preciso HTTPS.
const USE_HTTP = process.argv.includes('--http');
const CERT_FILE = path.join(__dirname, 'cert.pfx');
const CERT_PASS = 'ligacao-local';
const POLL_TIMEOUT_MS = 25_000;
// Um participante vivo faz poll a cada ~25s; depois disso é considerado morto
// (celular travou/descarregou) e a vaga na sala é liberada.
const PEER_STALE_MS = 45_000;

// ---------------------------------------------------------------------------
// Certificado HTTPS (autoassinado, gerado na primeira execução)
// ---------------------------------------------------------------------------

if (!USE_HTTP && !fs.existsSync(CERT_FILE)) {
  console.log('Primeira execução: gerando certificado HTTPS local...');
  execFileSync('powershell', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'gen-cert.ps1'),
  ], { stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// Sala: no máximo 2 participantes, cada um com uma fila de mensagens
// ---------------------------------------------------------------------------

let nextId = 1;
const peers = new Map(); // id -> { queue: [], waiter: null, lastSeen: number }

function alivePeers() {
  const now = Date.now();
  for (const [id, p] of peers) {
    if (now - p.lastSeen > PEER_STALE_MS) dropPeer(id);
  }
  return peers;
}

function dropPeer(id) {
  const p = peers.get(id);
  if (!p) return;
  if (p.waiter) {
    clearTimeout(p.waiter.timer);
    sendJson(p.waiter.res, 200, { messages: [] });
  }
  peers.delete(id);
  // Avisa quem ficou na sala
  for (const other of peers.values()) {
    other.queue.push({ type: 'bye' });
    flush(other);
  }
}

function flush(p) {
  if (!p.waiter || p.queue.length === 0) return;
  clearTimeout(p.waiter.timer);
  const res = p.waiter.res;
  p.waiter = null;
  p.lastSeen = Date.now();
  sendJson(res, 200, { messages: p.queue.splice(0) });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function sendJson(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 256 * 1024) {
        reject(new Error('payload muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Servir a interface
// ---------------------------------------------------------------------------

// Preferimos o build do React (client/dist); se não existir, caímos na
// página legada (index.html da raiz).
const WEB_ROOT = path.join(__dirname, 'client', 'dist');
const HAS_BUILD = fs.existsSync(path.join(WEB_ROOT, 'index.html'));
const LEGACY_INDEX = path.join(__dirname, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function serveIndex(res, root) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(root, 'index.html')));
}

function serveStatic(res, pathname) {
  if (!HAS_BUILD) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(LEGACY_INDEX));
    return;
  }
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(WEB_ROOT, rel);
  if (!filePath.startsWith(WEB_ROOT)) { // bloqueia path traversal
    sendJson(res, 403, { error: 'proibido' });
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      serveIndex(res, WEB_ROOT); // SPA: rota desconhecida -> index.html
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, 'https://x');

  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    serveStatic(res, url.pathname);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/join') {
    const room = alivePeers();
    if (room.size >= 2) {
      // Antes de recusar, derruba "fantasmas": quem está sem poll pendente
      // (a aba fechou/o celular morreu) há mais de 10s não está mais vivo.
      const now = Date.now();
      for (const [id, p] of room) {
        if (!p.waiter && now - p.lastSeen > 10_000) dropPeer(id);
      }
    }
    if (room.size >= 2) {
      sendJson(res, 409, { error: 'A sala já está cheia (2 pessoas).' });
      return;
    }
    const id = nextId++;
    const otherPresent = room.size > 0;
    peers.set(id, { queue: [], waiter: null, lastSeen: Date.now() });
    console.log(`[sala] participante ${id} entrou (${peers.size}/2)`);
    sendJson(res, 200, { id, otherPresent });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/poll') {
    const id = Number(url.searchParams.get('id'));
    const p = peers.get(id);
    if (!p) {
      sendJson(res, 410, { error: 'Você saiu da sala. Entre de novo.' });
      return;
    }
    p.lastSeen = Date.now();
    if (p.queue.length > 0) {
      sendJson(res, 200, { messages: p.queue.splice(0) });
      return;
    }
    // Segura a resposta até chegar mensagem ou estourar o tempo
    if (p.waiter) { // poll antigo (ex.: aba duplicada) é respondido vazio
      clearTimeout(p.waiter.timer);
      sendJson(p.waiter.res, 200, { messages: [] });
    }
    p.waiter = {
      res,
      timer: setTimeout(() => {
        p.waiter = null;
        // Só conta como sinal de vida se o navegador ainda está do outro lado
        if (res.socket && !res.socket.destroyed) p.lastSeen = Date.now();
        sendJson(res, 200, { messages: [] });
      }, POLL_TIMEOUT_MS),
    };
    req.on('close', () => {
      if (p.waiter && p.waiter.res === res) {
        clearTimeout(p.waiter.timer);
        p.waiter = null;
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/signal') {
    const body = await readBody(req);
    const from = peers.get(Number(body.id));
    if (!from) {
      sendJson(res, 410, { error: 'Você saiu da sala. Entre de novo.' });
      return;
    }
    from.lastSeen = Date.now();
    for (const [id, p] of peers) {
      if (id !== Number(body.id)) {
        p.queue.push(body.data);
        flush(p);
      }
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/leave') {
    const body = await readBody(req);
    const id = Number(body.id);
    if (peers.has(id)) {
      console.log(`[sala] participante ${id} saiu`);
      dropPeer(id);
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'não encontrado' });
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

const onRequest = (req, res) => {
  handle(req, res).catch((err) => {
    console.error('[erro]', err.message);
    sendJson(res, 500, { error: 'erro interno' });
  });
};

const server = USE_HTTP
  ? require('http').createServer(onRequest)
  : https.createServer({ pfx: fs.readFileSync(CERT_FILE), passphrase: CERT_PASS }, onRequest);

// Endereços típicos de Wi-Fi doméstico vêm primeiro; adaptadores virtuais
// (VPN, Hyper-V, WSL, Hamachi...) costumam usar outras faixas e vão por último.
function lanScore(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  if (ip.startsWith('10.')) return 2;
  return 3;
}

server.listen(PORT, () => {
  const proto = USE_HTTP ? 'http' : 'https';
  const addrs = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    }
  }
  addrs.sort((a, b) => lanScore(a) - lanScore(b));
  console.log('');
  console.log('=== Locall ===');
  console.log(HAS_BUILD
    ? '(servindo a interface React de client/dist)'
    : '(interface legada; rode `npm run build` em client/ para a UI nova)');
  if (USE_HTTP) console.log('(modo --http: só para teste; o microfone só funciona em localhost)');
  console.log('Abra este endereço no navegador dos DOIS aparelhos:');
  console.log('');
  for (const a of addrs) console.log(`    ${proto}://${a}:${PORT}`);
  if (addrs.length === 0) console.log(`    ${proto}://localhost:${PORT} (nenhuma rede detectada!)`);
  if (addrs.length > 1) {
    console.log('');
    console.log('Vários endereços? Use o primeiro (geralmente 192.168.x.x); se não');
    console.log('abrir no celular, tente os outros.');
  }
  console.log('');
  console.log('O navegador vai avisar que o certificado não é confiável —');
  console.log('é normal (certificado local): toque em "Avançado" e prossiga.');
  console.log('');
  console.log('Se o celular não abrir a página, o Firewall do Windows pode estar');
  console.log('bloqueando. Veja a seção "Firewall" no README.md.');
  console.log('');
  console.log('Para encerrar o servidor: Ctrl+C');
});
