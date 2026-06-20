#!/usr/bin/env node
// MCP server para o "Ligação Local".
// Expõe ferramentas para iniciar/parar/consultar o servidor de chamada de voz
// a partir de qualquer sessão do Claude. JSON-RPC 2.0 sobre stdio, sem
// dependências de npm (no mesmo espírito do app).
//
// IMPORTANTE: nada além de mensagens do protocolo pode ir para o stdout —
// qualquer log vai para stderr (console.error).

'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

const PROJECT_DIR = __dirname;
const SERVER_JS = path.join(PROJECT_DIR, 'server.js');
const STATE_FILE = path.join(PROJECT_DIR, '.mcp-state.json');
const PORT = Number(process.env.PORT) || 8443;

const SERVER_INFO = { name: 'ligacao-local', version: '1.0.0' };

// ---------------------------------------------------------------------------
// Descoberta de endereços da rede local (mesma lógica/ordenação do server.js)
// ---------------------------------------------------------------------------

function lanScore(ip) {
  if (ip.startsWith('192.168.')) return 0;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 1;
  if (ip.startsWith('10.')) return 2;
  return 3;
}

function localUrls() {
  const addrs = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    }
  }
  addrs.sort((a, b) => lanScore(a) - lanScore(b));
  return addrs.map((a) => `https://${a}:${PORT}`);
}

// ---------------------------------------------------------------------------
// Estado / detecção do processo do servidor de chamada
// ---------------------------------------------------------------------------

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[mcp] não consegui gravar estado:', err.message);
  }
}

function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0); // sinal 0 = só checa existência
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // existe, mas sem permissão = vivo
  }
}

// Confere se a porta da chamada está realmente aceitando conexões.
function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(1200);
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
    sock.on('error', () => resolve(false));
  });
}

// PIDs ouvindo na porta (pega instâncias iniciadas pelo .bat também).
function pidsOnPort(port) {
  try {
    const out = execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && Number(m[1]) === port) pids.add(Number(m[2]));
    }
    return [...pids];
  } catch {
    return [];
  }
}

async function callStatus() {
  const state = readState();
  const open = await isPortOpen(PORT);
  return {
    running: open,
    trackedPid: state.pid ?? null,
    trackedPidAlive: pidAlive(state.pid),
    startedAt: state.startedAt ?? null,
    urls: localUrls(),
  };
}

// ---------------------------------------------------------------------------
// Ferramentas (tools)
// ---------------------------------------------------------------------------

const CERT_HINT =
  'O navegador vai avisar que o certificado não é confiável (é normal, é local): ' +
  'em Chrome/Edge toque em "Avançado" → "Ir para o site"; no iPhone, "Mostrar detalhes" → "acessar".';

async function startCall() {
  if (await isPortOpen(PORT)) {
    const urls = localUrls();
    return text(
      `A chamada JÁ está no ar (porta ${PORT}).\n\n` +
      `Abram este endereço no navegador dos DOIS aparelhos (mesmo Wi-Fi):\n` +
      urls.map((u) => `  ${u}`).join('\n') +
      `\n\n${CERT_HINT}`,
    );
  }

  if (!fs.existsSync(SERVER_JS)) {
    return errorText(`Não encontrei server.js em ${SERVER_JS}. A pasta do projeto foi movida?`);
  }

  const child = spawn(process.execPath, [SERVER_JS], {
    cwd: PROJECT_DIR,
    detached: true,    // sobrevive ao fim desta sessão do Claude
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  writeState({ pid: child.pid, startedAt: new Date().toISOString() });

  // Espera o servidor subir de fato (gera o certificado na 1ª vez)
  let up = false;
  for (let i = 0; i < 20 && !up; i++) {
    await sleep(500);
    up = await isPortOpen(PORT);
  }

  const urls = localUrls();
  if (!up) {
    return errorText(
      `Tentei iniciar (PID ${child.pid}) mas a porta ${PORT} não respondeu a tempo.\n` +
      `Pode ser o Firewall do Windows bloqueando, ou a geração do certificado demorando. ` +
      `Veja a janela do servidor / o README (seção Firewall).`,
    );
  }
  return text(
    `Chamada iniciada (PID ${child.pid}, porta ${PORT}).\n\n` +
    `Abram este endereço no navegador dos DOIS aparelhos (mesmo Wi-Fi):\n` +
    urls.map((u) => `  ${u}`).join('\n') +
    `\n\n${CERT_HINT}`,
  );
}

async function stopCall() {
  const state = readState();
  const targets = new Set();
  if (pidAlive(state.pid)) targets.add(state.pid);
  for (const pid of pidsOnPort(PORT)) targets.add(pid);

  if (targets.size === 0) {
    writeState({});
    return text(`Nada para encerrar — a chamada não está rodando (porta ${PORT} fechada).`);
  }

  const killed = [];
  const failed = [];
  for (const pid of targets) {
    try {
      process.kill(pid);
      killed.push(pid);
    } catch (err) {
      failed.push(`${pid} (${err.code || err.message})`);
    }
  }
  writeState({});

  // O SO leva alguns ms para liberar a porta após o processo morrer;
  // espera fechar de fato para o status seguinte refletir a realidade.
  let stillOpen = true;
  for (let i = 0; i < 12 && stillOpen; i++) {
    await sleep(250);
    stillOpen = await isPortOpen(PORT);
  }

  let msg = `Chamada encerrada. Processos finalizados: ${killed.join(', ') || 'nenhum'}.`;
  if (failed.length) msg += `\nNão consegui finalizar: ${failed.join(', ')} (talvez precise de permissão de admin).`;
  if (stillOpen) msg += `\nAtenção: a porta ${PORT} ainda parece ocupada — pode haver outra instância fora do meu controle.`;
  return text(msg);
}

async function statusTool() {
  const s = await callStatus();
  const lines = [
    `Rodando: ${s.running ? 'SIM' : 'não'} (porta ${PORT})`,
    s.trackedPid ? `PID iniciado por mim: ${s.trackedPid} (${s.trackedPidAlive ? 'vivo' : 'morto'})` : 'PID iniciado por mim: nenhum',
    s.startedAt ? `Iniciado em: ${s.startedAt}` : null,
    '',
    'Endereços para abrir nos aparelhos:',
    ...s.urls.map((u) => `  ${u}`),
  ].filter((l) => l !== null);
  return text(lines.join('\n'));
}

function getUrlsTool() {
  const urls = localUrls();
  if (urls.length === 0) {
    return text('Nenhuma rede local detectada. O PC está conectado a um Wi-Fi/cabo?');
  }
  return text(
    `Endereços para abrir nos DOIS aparelhos (mesmo Wi-Fi):\n` +
    urls.map((u) => `  ${u}`).join('\n') +
    (urls.length > 1 ? `\n\nVários? Use o primeiro (geralmente 192.168.x.x); se não abrir, tente os outros.` : '') +
    `\n\n${CERT_HINT}`,
  );
}

const TOOLS = [
  {
    name: 'start_call',
    description:
      'Inicia o servidor de chamada de voz por rede local (Ligação Local) e devolve os endereços ' +
      'para abrir nos dois aparelhos. Se já estiver rodando, só devolve os endereços. O servidor ' +
      'continua no ar mesmo depois que esta sessão do Claude terminar.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: startCall,
  },
  {
    name: 'stop_call',
    description: 'Encerra o servidor de chamada de voz por rede local (libera a porta).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: stopCall,
  },
  {
    name: 'call_status',
    description: 'Diz se a chamada está no ar, qual PID, e os endereços de acesso.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: statusTool,
  },
  {
    name: 'get_urls',
    description: 'Devolve só os endereços (URLs) para abrir nos aparelhos, sem iniciar nada.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => getUrlsTool(),
  },
];

// ---------------------------------------------------------------------------
// Helpers de resposta de tool
// ---------------------------------------------------------------------------

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
function errorText(t) {
  return { content: [{ type: 'text', text: t }], isError: true };
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Loop JSON-RPC sobre stdio
// ---------------------------------------------------------------------------

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function dispatch(req) {
  const { id, method, params } = req;
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case 'initialize': {
      const requested = params && typeof params.protocolVersion === 'string'
        ? params.protocolVersion
        : '2024-11-05';
      reply(id, {
        protocolVersion: requested,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    case 'notifications/initialized':
    case 'initialized':
      return; // notificação: sem resposta

    case 'ping':
      if (isRequest) reply(id, {});
      return;

    case 'tools/list':
      reply(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });
      return;

    case 'tools/call': {
      const name = params && params.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) {
        replyError(id, -32602, `Ferramenta desconhecida: ${name}`);
        return;
      }
      try {
        const result = await tool.run((params && params.arguments) || {});
        reply(id, result);
      } catch (err) {
        console.error('[mcp] erro na tool', name, err);
        reply(id, errorText(`Erro ao executar ${name}: ${err.message}`));
      }
      return;
    }

    default:
      if (isRequest) replyError(id, -32601, `Método não suportado: ${method}`);
      return;
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch (err) {
      console.error('[mcp] JSON inválido:', line);
      continue;
    }
    Promise.resolve(dispatch(req)).catch((err) => console.error('[mcp] dispatch falhou:', err));
  }
});

process.stdin.on('end', () => process.exit(0));
console.error(`[mcp] Ligação Local MCP pronto (projeto: ${PROJECT_DIR}, porta: ${PORT})`);
