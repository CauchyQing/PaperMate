import { BrowserWindow } from 'electron';
import {
  estimateTokens,
  splitIntoChunks,
  buildContextWindow,
  createTranslationPrompt,
} from './context-manager';
import { chatStream } from './ai-service';
import type { ChatMessage, AIProviderConfig } from '../../shared/types/ai';
import { configService } from './config';

interface TranslationProgress {
  chunkIndex: number;
  totalChunks: number;
  currentChunkTokens: number;
  glossary: Record<string, string>;
}

interface TranslationResult {
  fullTranslation: string;
  glossary: Record<string, string>;
  totalTokens: number;
}

const activeTranslations = new Map<string, AbortController>();

/**
 * Translate long text by splitting into chunks and maintaining glossary.
 */
export async function translateLongText(
  win: BrowserWindow,
  text: string,
  onProgress?: (progress: TranslationProgress) => void
): Promise<string> {
  const provider = configService.getActiveProvider();
  if (!provider) throw new Error('未配置 AI 供应商');

  const maxChunkTokens = provider.maxTokens
    ? Math.floor(provider.maxTokens * 0.6) // Reserve space for response
    : 2000;

  const { chunks } = splitIntoChunks(text, maxChunkTokens);
  const glossary: Record<string, string> = {};
  const translations: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const isFirst = i === 0;
    const isLast = i === chunks.length - 1;
    const chunk = chunks[i];

    const prompt = createTranslationPrompt(chunk, glossary, isFirst, isLast);
    const messages: ChatMessage[] = [{ role: 'user', content: prompt }];

    // Build context window with previous translations for continuity
    if (!isFirst && translations.length > 0) {
      const contextMsg: ChatMessage = {
        role: 'assistant',
        content: `前文翻译：\n${translations[translations.length - 1].slice(-500)}`,
      };
      const { messages: contextMessages } = buildContextWindow(
        [contextMsg, ...messages],
        provider.maxTokens || 8000,
        Math.floor((provider.maxTokens || 8000) * 0.3)
      );
      messages.length = 0;
      messages.push(...contextMessages);
    }

    // Progress callback
    onProgress?.({
      chunkIndex: i,
      totalChunks: chunks.length,
      currentChunkTokens: estimateTokens(chunk),
      glossary,
    });

    // Stream this chunk
    let chunkTranslation = '';
    const requestId = await chatStream(win, messages, {
      temperature: 0.3, // Lower temperature for more consistent translation
    });

    // Wait for completion and collect result
    await new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        win.webContents.off('ipc-message', handler);
      };

      const handler = (event: any, channel: string, data: any) => {
        if (channel === 'ai:stream-event' && data.requestId === requestId) {
          if (data.type === 'chunk') {
            chunkTranslation += data.content;
          } else if (data.type === 'done') {
            cleanup();
            resolve();
          } else if (data.type === 'error') {
            cleanup();
            reject(new Error(data.error));
          }
        }
      };

      win.webContents.on('ipc-message', handler);

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('翻译超时'));
      }, 5 * 60 * 1000);
    });

    translations.push(chunkTranslation);

    // Extract new glossary entries from translation (simple heuristic)
    const glossaryMatch = chunkTranslation.match(/术语对照表[：:]\s*([\s\S]*?)(?:\n\n|$)/);
    if (glossaryMatch) {
      const lines = glossaryMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^(.+?)\s*[→→]\s*(.+)$/);
        if (match) {
          glossary[match[1].trim()] = match[2].trim();
        }
      }
    }
  }

  return translations.join('\n\n');
}

/**
 * Cancel an active translation.
 */
export function cancelTranslation(requestId: string): boolean {
  const controller = activeTranslations.get(requestId);
  if (controller) {
    controller.abort();
    activeTranslations.delete(requestId);
    return true;
  }
  return false;
}
