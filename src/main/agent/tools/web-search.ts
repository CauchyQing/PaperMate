import { registerTool } from '../tool-registry';
import { ensureCdpProxy } from './cdp-bridge';
import * as os from 'os';
import * as path from 'path';
import { chromium } from 'playwright';

async function cdpRequest(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = `http://127.0.0.1:3456${endpoint}`;
  return fetch(url, options);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function searchWithCdp(query: string, maxResults: number): Promise<string> {
  const skillDir = path.join(os.homedir(), '.papermate', 'skills', 'web-access');
  await ensureCdpProxy(skillDir);

  const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;

  // 1. Create new tab
  const newRes = await cdpRequest(`/new?url=${encodeURIComponent(searchUrl)}`);
  const newJson = await newRes.json().catch(async () => ({ targetId: (await newRes.text()).trim() }));
  const target = newJson.targetId || (await newRes.text()).trim();
  if (!target) {
    throw new Error('Failed to create new browser tab');
  }

  // 2. Wait for page load
  await sleep(3000);

  try {
    // 3. Extract results
    const evalScript = `JSON.stringify(Array.from(document.querySelectorAll('.gs_ri')).slice(0, ${maxResults}).map(el => ({
      title: el.querySelector('.gs_rt')?.innerText || '',
      authors: el.querySelector('.gs_a')?.innerText || '',
      snippet: el.querySelector('.gs_rs')?.innerText || ''
    })))`;
    const resultsRes = await cdpRequest(`/eval?target=${encodeURIComponent(target)}`, {
      method: 'POST',
      body: evalScript,
    });
    const resultsText = await resultsRes.text();
    return resultsText || 'No results found.';
  } finally {
    // 4. Close tab
    await cdpRequest(`/close?target=${encodeURIComponent(target)}`).catch(() => {});
  }
}

async function searchWithPlaywright(query: string, maxResults: number): Promise<string> {
  let browser;
  try {
    // Try to launch with explicit executable path for packaged apps
    const launchOptions: any = { headless: true };
    
    // In packaged app, Playwright may not find browsers automatically
    // Try to use system Chrome/Chromium if available
    if (process.platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
        process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
      ];
      for (const chromePath of possiblePaths) {
        if (chromePath && require('fs').existsSync(chromePath)) {
          launchOptions.executablePath = chromePath;
          console.log('[web_search] Using Chrome at:', chromePath);
          break;
        }
      }
    }
    
    browser = await chromium.launch(launchOptions);
  } catch (launchErr: any) {
    console.error('[web_search] Failed to launch browser:', launchErr.message);
    throw new Error('无法启动浏览器。请确保系统已安装 Chrome 或 Chromium。');
  }
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  try {
    const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('.gs_r, .gs_or, .gs_ri', { timeout: 10000 }).catch(() => {});

    const results = await page.evaluate((limit) => {
      const nodes = document.querySelectorAll('.gs_ri');
      const out: Array<{ title: string; authors: string; snippet: string }> = [];
      nodes.forEach((node, idx) => {
        if (idx >= limit) return;
        out.push({
          title: node.querySelector('.gs_rt')?.textContent || '',
          authors: node.querySelector('.gs_a')?.textContent || '',
          snippet: node.querySelector('.gs_rs')?.textContent || '',
        });
      });
      return out;
    }, maxResults);

    return JSON.stringify(results);
  } finally {
    await browser.close();
  }
}

registerTool(
  {
    name: 'web_search',
    description: 'Search Google Scholar for academic papers by keywords. Uses Playwright by default; falls back to CDP if needed.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results to return (default 5)' },
      },
      required: ['query'],
    },
  },
  async (args) => {
    const query = String(args.query);
    const maxResults = Math.min(Number(args.maxResults || 5), 10);

    // Default to Playwright for stability; fallback to CDP
    try {
      return await searchWithPlaywright(query, maxResults);
    } catch (pwErr: any) {
      console.log('[web_search] Playwright failed, falling back to CDP:', pwErr.message || pwErr);
      return await searchWithCdp(query, maxResults);
    }
  }
);
