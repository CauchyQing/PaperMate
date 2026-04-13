import type { ChatMessage } from '../../shared/types/ai';

// Token estimation constants
const CHINESE_TOKENS_PER_CHAR = 1.5;
const ENGLISH_TOKENS_PER_WORD = 1.3;
const OVERHEAD_TOKENS = 4; // Format overhead per message

export interface ChunkResult {
  chunks: string[];
  totalTokens: number;
}

export interface ContextWindow {
  messages: ChatMessage[];
  estimatedTokens: number;
}

/**
 * Estimate token count for a given text.
 * Uses language-specific heuristics.
 */
export function estimateTokens(text: string): number {
  let tokens = 0;
  // Split by language
  const segments = text.split(/([\u4e00-\u9fa5]+)/g);
  for (const segment of segments) {
    if (/^[\u4e00-\u9fa5]+$/.test(segment)) {
      // Chinese
      tokens += segment.length * CHINESE_TOKENS_PER_CHAR;
    } else {
      // English/others - count words
      const words = segment.trim().split(/\s+/).filter(w => w.length > 0);
      tokens += words.length * ENGLISH_TOKENS_PER_WORD;
    }
  }
  return Math.ceil(tokens);
}

/**
 * Estimate total tokens for a conversation.
 */
export function estimateConversationTokens(messages: ChatMessage[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(c => c.text || '').join('');
    return total + estimateTokens(content) + OVERHEAD_TOKENS;
  }, 0);
}

/**
 * Split text into chunks based on max token limit.
 * Tries to preserve sentence boundaries.
 */
export function splitIntoChunks(text: string, maxTokensPerChunk: number = 2000): ChunkResult {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (sentenceTokens > maxTokensPerChunk) {
      // Single sentence too long - force split by characters
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
      // Force split long sentence
      const chars = sentence.split('');
      let forceChunk = '';
      for (const char of chars) {
        forceChunk += char;
        if (estimateTokens(forceChunk) >= maxTokensPerChunk) {
          chunks.push(forceChunk.trim());
          forceChunk = '';
        }
      }
      if (forceChunk) {
        currentChunk = forceChunk;
        currentTokens = estimateTokens(forceChunk);
      }
    } else if (currentTokens + sentenceTokens <= maxTokensPerChunk) {
      currentChunk += sentence;
      currentTokens += sentenceTokens;
    } else {
      // Save current chunk and start new one
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      currentTokens = sentenceTokens;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return {
    chunks,
    totalTokens: estimateTokens(text),
  };
}

/**
 * Build a sliding window of context messages.
 * Keeps as much recent context as possible within token limit.
 */
export function buildContextWindow(
  messages: ChatMessage[],
  maxTokens: number = 8000,
  reserveTokens: number = 2000
): ContextWindow {
  const availableTokens = maxTokens - reserveTokens;
  const result: ChatMessage[] = [];
  let currentTokens = 0;

  // Always include system message if present
  const systemMsg = messages.find(m => m.role === 'system');
  if (systemMsg) {
    const content = typeof systemMsg.content === 'string'
      ? systemMsg.content
      : '';
    const tokens = estimateTokens(content) + OVERHEAD_TOKENS;
    result.push(systemMsg);
    currentTokens += tokens;
  }

  // Include recent messages from end until we hit the limit
  const recentMessages = [...messages].reverse().filter(m => m.role !== 'system');

  for (const msg of recentMessages) {
    const content = typeof msg.content === 'string'
      ? msg.content
      : msg.content.map(c => c.text || '').join('');
    const tokens = estimateTokens(content) + OVERHEAD_TOKENS;

    if (currentTokens + tokens > availableTokens) {
      break;
    }

    result.push(msg);
    currentTokens += tokens;
  }

  // Reverse to maintain chronological order (except system message stays first)
  const systemMessages = result.filter(m => m.role === 'system');
  const otherMessages = result.filter(m => m.role !== 'system').reverse();

  return {
    messages: [...systemMessages, ...otherMessages],
    estimatedTokens: currentTokens,
  };
}

/**
 * Create a glossary maintenance prompt for translation.
 */
export function createTranslationPrompt(
  text: string,
  glossary: Record<string, string> = {},
  isFirstChunk: boolean = true,
  isLastChunk: boolean = true
): string {
  const glossaryStr = Object.entries(glossary)
    .map(([term, translation]) => `${term} → ${translation}`)
    .join('\n');

  let prompt = '';

  if (isFirstChunk) {
    prompt += `你是一个专业的学术文献翻译助手。请将以下学术论文内容翻译成中文。\n\n`;
    prompt += `翻译要求：\n`;
    prompt += `1. 保持学术性和专业性，使用规范的学术用语\n`;
    prompt += `2. 保持原文的段落结构和逻辑关系\n`;
    prompt += `3. 对于专业术语，首次出现时标注英文原词\n`;
    prompt += `4. 人名、地名保持原文或通用译名\n`;
    prompt += `5. 数学公式和代码保持原样\n\n`;

    if (glossaryStr) {
      prompt += `已确定的术语对照表：\n${glossaryStr}\n\n`;
    }
  } else {
    prompt += `继续翻译以下内容（保持与之前翻译的连贯性）：\n\n`;
    if (glossaryStr) {
      prompt += `术语对照表：\n${glossaryStr}\n\n`;
    }
  }

  prompt += `待翻译文本：\n${text}\n\n`;

  if (isLastChunk) {
    prompt += `\n请完成翻译。如有新发现的专业术语，请在翻译后列出术语对照表。`;
  }

  return prompt;
}
