import { BrowserWindow } from 'electron';
import { runAgentLoop, AgentEventHandler } from './agent-loop';
import type { AgentMessage } from '../../shared/types/agent';
import type { ChatStreamEvent } from '../../shared/types/ai';
import type { PdfContext } from '../../shared/types';

const activeAgents = new Map<string, AbortController>();

export async function startAgentLoop(
  win: BrowserWindow,
  messages: AgentMessage[],
  options?: {
    requestId?: string;
    maxIterations?: number;
    providerId?: string;
    attachments?: Array<{ type: string; path: string; name: string }>;
    pdfContext?: PdfContext;
  }
): Promise<string> {
  const requestId = options?.requestId || `agent_${Date.now()}`;
  const controller = new AbortController();
  activeAgents.set(requestId, controller);

  const onEvent: AgentEventHandler = (event: ChatStreamEvent) => {
    win.webContents.send('ai:stream-event', event);
  };

  try {
    await runAgentLoop(messages, {
      requestId,
      maxIterations: options?.maxIterations ?? 15,
      providerId: options?.providerId,
      onEvent,
      signal: controller.signal,
      attachments: options?.attachments,
      pdfContext: options?.pdfContext,
    });
  } finally {
    activeAgents.delete(requestId);
  }

  return requestId;
}

export function stopAgentLoop(requestId: string): boolean {
  const controller = activeAgents.get(requestId);
  if (controller) {
    controller.abort();
    activeAgents.delete(requestId);
    return true;
  }
  return false;
}

/**
 * Stop all active agent loops.
 * Called on app quit to prevent hanging connections from keeping the process alive.
 */
export function stopAllAgentLoops(): void {
  for (const [requestId, controller] of activeAgents) {
    controller.abort();
    activeAgents.delete(requestId);
  }
}
