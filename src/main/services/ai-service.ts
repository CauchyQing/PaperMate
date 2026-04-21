import { BrowserWindow } from 'electron';
import { configService } from './config';
import type { AIProviderConfig } from '../../shared/types/ai';
import type { ChatMessage, ChatOptions } from '../../shared/types/ai';

// Track active requests for cancellation
const activeRequests = new Map<string, AbortController>();
let requestCounter = 0;

function generateRequestId(): string {
  return `req_${Date.now()}_${++requestCounter}`;
}

function getProvider(providerId?: string): AIProviderConfig {
  const provider = providerId
    ? configService.getAIProviders().find(p => p.id === providerId)
    : configService.getActiveProvider();
  if (!provider) throw new Error('未配置 AI 供应商，请先在设置中添加');
  return provider;
}

/**
 * Non-streaming chat — returns the full response text.
 * Used for paper analysis and other non-interactive scenarios.
 */
export async function chatSync(
  messages: ChatMessage[],
  options?: ChatOptions & { providerId?: string }
): Promise<string> {
  const provider = getProvider(options?.providerId);
  const model = options?.model || provider.defaultModel;

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? provider.maxTokens ?? 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${body}`);
  }

  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Streaming chat generator — yields chunks of text.
 */
export async function* chatStreamGenerator(
  messages: ChatMessage[],
  options?: ChatOptions & { providerId?: string; signal?: AbortSignal }
): AsyncGenerator<string, void, unknown> {
  const provider = getProvider(options?.providerId);
  const model = options?.model || provider.defaultModel;

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? provider.maxTokens ?? 4096,
      stream: true,
    }),
    signal: options?.signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI 请求失败 (${res.status}): ${body.slice(0, 200)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('无法读取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const decoded = decoder.decode(value, { stream: true });
    buffer += decoded;

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content
          || parsed.choices?.[0]?.message?.content
          || parsed.content
          || parsed.text
          || parsed.response;
        if (content) {
          yield content;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }
  }
}

/**
 * Streaming chat — pushes chunks to the renderer via IPC.
 * Returns the requestId so the caller can track/cancel.
 */
export async function chatStream(
  win: BrowserWindow,
  messages: ChatMessage[],
  options?: ChatOptions & { providerId?: string; requestId?: string }
): Promise<string> {
  const requestId = options?.requestId || generateRequestId();
  const controller = new AbortController();
  activeRequests.set(requestId, controller);

  // Fire-and-forget the streaming work
  (async () => {
    try {
      const generator = chatStreamGenerator(messages, { ...options, signal: controller.signal });
      for await (const chunk of generator) {
        win.webContents.send('ai:stream-event', {
          type: 'chunk',
          content: chunk,
          requestId,
        });
      }

      // Stream ended without error
      win.webContents.send('ai:stream-event', {
        type: 'done',
        requestId,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        win.webContents.send('ai:stream-event', {
          type: 'done',
          requestId,
        });
      } else {
        win.webContents.send('ai:stream-event', {
          type: 'error',
          error: err.message || '未知错误',
          requestId,
        });
      }
    } finally {
      activeRequests.delete(requestId);
    }
  })();

  return requestId;
}

/**
 * Cancel an active streaming request.
 */
export function cancelRequest(requestId: string): boolean {
  const controller = activeRequests.get(requestId);
  if (controller) {
    controller.abort();
    activeRequests.delete(requestId);
    return true;
  }
  return false;
}

/**
 * Cancel all active streaming requests.
 * Called on app quit to prevent hanging connections from keeping the process alive.
 */
export function cancelAllRequests(): void {
  for (const [requestId, controller] of activeRequests) {
    controller.abort();
    activeRequests.delete(requestId);
  }
}

/**
 * Test connection to an AI provider — sends a minimal request.
 */
export async function testConnection(provider: AIProviderConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || '连接失败' };
  }
}
