import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as net from 'net';
import { registerTool } from '../tool-registry';

const PORT = 3456;
let cdpProxyProcess: ChildProcess | null = null;
let cdpProxyStarting = false;
let cdpProxyReady = false;

async function waitForPort(port: number, timeout = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.createConnection(port, '127.0.0.1');
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', reject);
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error(`CDP Proxy port ${port} did not become available within ${timeout}ms`);
}

export async function ensureCdpProxy(skillDir?: string): Promise<void> {
  if (cdpProxyReady) return;
  if (cdpProxyStarting) {
    await waitForPort(PORT, 20000);
    return;
  }

  cdpProxyStarting = true;
  try {
    // Try to connect to an existing proxy first
    await waitForPort(PORT, 1000);
    cdpProxyReady = true;
    cdpProxyStarting = false;
    return;
  } catch {
    // Not running, start it
  }

  const scriptPath = skillDir ? path.join(skillDir, 'scripts', 'cdp-proxy.mjs') : null;
  if (!scriptPath) {
    cdpProxyStarting = false;
    throw new Error('web-access skill not found; cannot start CDP Proxy');
  }

  console.log('[CDP Bridge] Starting CDP Proxy:', scriptPath);
  // In packaged apps, system 'node' may not be in PATH. Electron's own binary embeds Node.js
  // and can execute .mjs scripts, so we use it as a fallback.
  let nodeBinary = 'node';
  try {
    require('child_process').execSync('node --version', { stdio: 'ignore', timeout: 2000 });
  } catch {
    nodeBinary = process.execPath;
  }
  cdpProxyProcess = spawn(nodeBinary, [scriptPath], {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: nodeBinary === process.execPath
      ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      : process.env,
  });

  cdpProxyProcess.stdout?.on('data', (data) => {
    console.log('[CDP Proxy]', data.toString().trim());
  });
  cdpProxyProcess.stderr?.on('data', (data) => {
    console.error('[CDP Proxy]', data.toString().trim());
  });

  cdpProxyProcess.on('exit', (code) => {
    console.log('[CDP Proxy] exited with code', code);
    cdpProxyProcess = null;
    cdpProxyReady = false;
  });

  await waitForPort(PORT, 20000);
  cdpProxyReady = true;
  cdpProxyStarting = false;
}

export function stopCdpProxy(): void {
  if (cdpProxyProcess) {
    cdpProxyProcess.kill('SIGTERM');
    cdpProxyProcess = null;
    cdpProxyReady = false;
  }
}

async function cdpRequest(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `http://127.0.0.1:${PORT}${endpoint}`;
  return fetch(url, options);
}

// Register CDP tools
registerTool(
  {
    name: 'cdp_new',
    description: 'Create a new browser tab and navigate to a URL. Returns the target ID.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open' },
      },
      required: ['url'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/new?url=${encodeURIComponent(String(args.url))}`);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed.targetId || text;
    } catch {
      return text;
    }
  }
);

registerTool(
  {
    name: 'cdp_eval',
    description: 'Execute JavaScript in a specific tab.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
        script: { type: 'string', description: 'JavaScript code to execute' },
      },
      required: ['target', 'script'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/eval?target=${encodeURIComponent(String(args.target))}`, {
      method: 'POST',
      body: String(args.script),
    });
    return await res.text();
  }
);

registerTool(
  {
    name: 'cdp_click',
    description: 'Click an element by CSS selector in a specific tab.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
        selector: { type: 'string', description: 'CSS selector' },
      },
      required: ['target', 'selector'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/click?target=${encodeURIComponent(String(args.target))}`, {
      method: 'POST',
      body: String(args.selector),
    });
    return await res.text();
  }
);

registerTool(
  {
    name: 'cdp_screenshot',
    description: 'Capture a screenshot of a specific tab.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
        file: { type: 'string', description: 'Absolute file path to save the screenshot' },
      },
      required: ['target', 'file'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/screenshot?target=${encodeURIComponent(String(args.target))}&file=${encodeURIComponent(String(args.file))}`);
    return await res.text();
  }
);

registerTool(
  {
    name: 'cdp_navigate',
    description: 'Navigate a specific tab to a new URL.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['target', 'url'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/navigate?target=${encodeURIComponent(String(args.target))}&url=${encodeURIComponent(String(args.url))}`);
    return await res.text();
  }
);

registerTool(
  {
    name: 'cdp_close',
    description: 'Close a specific tab.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
      },
      required: ['target'],
    },
  },
  async (args) => {
    const res = await cdpRequest(`/close?target=${encodeURIComponent(String(args.target))}`);
    return await res.text();
  }
);

registerTool(
  {
    name: 'cdp_scroll',
    description: 'Scroll a specific tab.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target ID' },
        y: { type: 'number', description: 'Y offset to scroll to' },
        direction: { type: 'string', description: 'bottom or top' },
      },
      required: ['target'],
    },
  },
  async (args) => {
    const target = encodeURIComponent(String(args.target));
    const y = args.y !== undefined ? `&y=${args.y}` : '';
    const direction = args.direction ? `&direction=${encodeURIComponent(String(args.direction))}` : '';
    const res = await cdpRequest(`/scroll?target=${target}${y}${direction}`);
    return await res.text();
  }
);
