#!/usr/bin/env node
/**
 * CodeFID Local/Remote CLI Bridge Server
 * Connects the CodeFID Tablet PWA IDE to local CLI tools (Claude Code CLI, Antigravity `agy` CLI, Git, Firebase CLI).
 * Run with: npm run bridge (listens on port 8787 by default)
 */
import http from 'node:http';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const PORT = Number(process.env.CODEFID_BRIDGE_PORT || 8787);

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function detectCliTools() {
  const checks = {
    antigravityCli: false,
    claudeCli: false,
    gitCli: false,
    firebaseCli: false,
    nodeVersion: process.version
  };
  try {
    await execAsync('which agy || which antigravity');
    checks.antigravityCli = true;
  } catch {}
  try {
    await execAsync('which claude');
    checks.claudeCli = true;
  } catch {}
  try {
    await execAsync('which git');
    checks.gitCli = true;
  } catch {}
  try {
    await execAsync('which firebase');
    checks.firebaseCli = true;
  } catch {}
  return checks;
}

const server = http.createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    const tools = await detectCliTools();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'CodeFID Agent Bridge',
        timestamp: new Date().toISOString(),
        tools
      })
    );
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/exec') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { command } = JSON.parse(body || '{}');
      if (!command || typeof command !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing command' }));
        return;
      }
      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 25000
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, stdout, stderr }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: false,
          stdout: err.stdout || '',
          stderr: err.stderr || err.message || 'Command failed'
        })
      );
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CodeFID Bridge] Listening on http://0.0.0.0:${PORT}`);
});
