import { create } from 'zustand';
import type { Conversation, Message } from '../../shared/types';
import type { ChatStreamEvent } from '../../shared/types/ai';
import type { AgentStep } from '../../shared/types/agent';

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  activeRequestId: string | null;
  currentWorkspacePath: string | null;
  error: string | null;
  prefillText: string | null;
  // Conversation summaries: conversationId -> summary text
  summaries: Record<string, string>;
  // Whether summary is being generated
  isGeneratingSummary: boolean;
  // Agent steps for the current turn
  agentSteps: AgentStep[];

  // Actions
  loadConversations: (workspacePath: string) => Promise<void>;
  createConversation: (workspacePath: string, data: Partial<Conversation>) => Promise<Conversation>;
  deleteConversation: (workspacePath: string, id: string) => Promise<void>;
  setActiveConversation: (workspacePath: string, id: string | null) => Promise<void>;
  sendMessage: (workspacePath: string, content: string, metadata?: Message['metadata']) => Promise<void>;
  stopStreaming: () => Promise<void>;
  handleStreamEvent: (event: ChatStreamEvent) => void;
  clearError: () => void;
  setPrefillText: (text: string | null) => void;
  updateConversationTitle: (workspacePath: string, id: string, newTitle: string) => Promise<void>;
  updateConversationPdfContext: (workspacePath: string, id: string, pdfContext: import('../../shared/types').PdfContext) => Promise<void>;
  // Generate summary for long conversation
  generateSummary: (workspacePath: string, messages: Message[]) => Promise<string>;
  clearAgentSteps: () => void;
}

let unsubStreamEvent: (() => void) | null = null;

// Token estimation helper
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars / 4 + otherChars / 1.3) + 4;
}

// Summary generation prompt
const SUMMARY_PROMPT = `请对以下对话内容进行摘要总结。摘要需要包含：
1. 讨论的核心主题和关键概念
2. 重要的技术细节或结论
3. 提到的专业术语及其含义
4. 对话的上下文背景（如涉及哪篇论文）

请用简洁的语言总结，控制在 300 字以内，确保后续对话可以基于这个摘要理解之前的讨论内容。

对话内容：`;

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
  activeRequestId: null,
  currentWorkspacePath: null,
  error: null,
  prefillText: null,
  summaries: {},
  isGeneratingSummary: false,
  agentSteps: [],

  setPrefillText: (text: string | null) => set({ prefillText: text }),
  clearAgentSteps: () => set({ agentSteps: [] }),

  loadConversations: async (workspacePath: string) => {
    const conversations = await window.electronAPI.conversationList(workspacePath);
    set({ conversations, currentWorkspacePath: workspacePath });
  },

  createConversation: async (workspacePath: string, data: Partial<Conversation>) => {
    const conv = await window.electronAPI.conversationCreate(workspacePath, {
      topic: data.topic || '新对话',
      paperId: data.paperId,
      paperTitle: data.paperTitle,
    });
    set(s => ({ conversations: [conv, ...s.conversations] }));
    await get().setActiveConversation(workspacePath, conv.id);
    return conv;
  },

  deleteConversation: async (workspacePath: string, id: string) => {
    await window.electronAPI.conversationDelete(workspacePath, id);
    set(s => {
      const conversations = s.conversations.filter(c => c.id !== id);
      const needSwitch = s.activeConversationId === id;
      // Also clean up summary
      const { [id]: _, ...remainingSummaries } = s.summaries;
      return {
        conversations,
        activeConversationId: needSwitch ? (conversations[0]?.id || null) : s.activeConversationId,
        messages: needSwitch ? [] : s.messages,
        summaries: remainingSummaries,
      };
    });
  },

  setActiveConversation: async (workspacePath: string, id: string | null) => {
    set({ activeConversationId: id, messages: [], streamingContent: '', agentSteps: [] });
    if (id) {
      const messages = await window.electronAPI.messageList(workspacePath, id);
      set({ messages });
    }
  },

  generateSummary: async (_workspacePath: string, messages: Message[]): Promise<string> => {
    const { activeConversationId, isGeneratingSummary } = get();
    if (!activeConversationId || isGeneratingSummary) return '';

    set({ isGeneratingSummary: true });
    console.log('[Conversation] Generating summary for conversation:', activeConversationId);

    try {
      // Build conversation text for summary (only user and assistant messages)
      const conversationText = messages
        .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
        .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`)
        .join('\n\n');

      const summaryRequestId = `summary_${Date.now()}`;
      const summaryMessages = [
        { role: 'system' as const, content: '你是一个对话摘要助手。请简洁准确地总结对话内容。' },
        { role: 'user' as const, content: SUMMARY_PROMPT + conversationText },
      ];

      // Send summary request
      await window.electronAPI.aiChat(summaryMessages, { requestId: summaryRequestId });

      // Wait for summary completion
      let summary = '';
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('摘要生成超时'));
        }, 60000);

        const checkSummary = (event: ChatStreamEvent) => {
          if (event.requestId !== summaryRequestId) return;

          if (event.type === 'chunk' && event.content) {
            summary += event.content;
          } else if (event.type === 'done') {
            clearTimeout(timeout);
            resolve();
          } else if (event.type === 'error') {
            clearTimeout(timeout);
            reject(new Error(event.error));
          }
        };

        // Temporarily override the event handler
        const originalHandler = unsubStreamEvent;
        unsubStreamEvent = window.electronAPI.onAIStreamEvent((event: ChatStreamEvent) => {
          checkSummary(event);
          // Also call original handler for other events
          if (event.requestId === summaryRequestId) return;
          get().handleStreamEvent(event);
        });

        // Restore original handler after completion
        setTimeout(() => {
          unsubStreamEvent = originalHandler;
        }, 60000);
      });

      // Store summary
      if (summary && activeConversationId) {
        set(s => ({
          summaries: { ...s.summaries, [activeConversationId]: summary },
        }));
        console.log('[Conversation] Summary generated:', summary.slice(0, 100) + '...');
      }

      return summary;
    } catch (error) {
      console.error('[Conversation] Failed to generate summary:', error);
      return '';
    } finally {
      set({ isGeneratingSummary: false });
    }
  },

  sendMessage: async (workspacePath: string, content: string, metadata?: Message['metadata']) => {
    const { activeConversationId, messages, summaries, isGeneratingSummary, conversations } = get();
    if (!activeConversationId) return;

    const activeConv = conversations.find(c => c.id === activeConversationId);

    // Build display content with attachment info
    let displayContent = content;
    const attachments = metadata?.attachments;
    if (attachments && attachments.length > 0) {
      const attachmentDesc = attachments.map(a => `[Attached ${a.type.toUpperCase()}: ${a.name} at ${a.path}]`).join('\n');
      displayContent = `${content}\n\n${attachmentDesc}`;
    }

    // Ensure PDF context is built if a new PDF is attached
    let pdfContext = activeConv?.pdfContext;
    const pdfAttachment = attachments?.find(a => a.type === 'pdf');
    if (pdfAttachment) {
      const isDifferentPdf = !pdfContext || pdfContext.filePath !== pdfAttachment.path;
      if (isDifferentPdf) {
        // Show a temporary loading-like state by setting error to inform user
        set({ error: '正在提取并分析 PDF，请稍候...' });
        try {
          const built = await window.electronAPI.buildPdfContext(pdfAttachment.path, pdfAttachment.name);
          pdfContext = built;
          await get().updateConversationPdfContext(workspacePath, activeConversationId, built);
        } catch (err: any) {
          console.error('[Conversation] Failed to build PDF context:', err);
          set({ error: `PDF 分析失败: ${err.message || '未知错误'}` });
          return;
        } finally {
          setTimeout(() => set(s => s.error?.startsWith('正在提取') || s.error?.startsWith('PDF 分析') ? { error: null } : {}), 100);
        }
      }
    }

    // Save user message
    const userMsg = await window.electronAPI.messageAdd(workspacePath, {
      conversationId: activeConversationId,
      role: 'user',
      content: displayContent,
      contentType: metadata?.imageData ? 'mixed' : 'text',
      metadata,
    });

    // Update local state with new message
    const updatedMessages = [...messages, userMsg];
    set({ messages: updatedMessages, agentSteps: [] });

    // Calculate total estimated tokens
    const totalEstimatedTokens = updatedMessages.reduce((total, m) => {
      const text = m.metadata?.imageData ? m.content + '[image]' : m.content;
      return total + estimateTokens(text);
    }, 0);

    // Context management thresholds (for 200k context model)
    const SUMMARY_THRESHOLD = 80000;
    const MAX_CONTEXT_TOKENS = 120000;
    const RECENT_MESSAGES_COUNT = 10;
    const SUMMARY_UPDATE_THRESHOLD = 20000;

    let contextMessages: Message[] = [...updatedMessages];
    let hasSummaryContext = false;

    if (totalEstimatedTokens > MAX_CONTEXT_TOKENS) {
      console.log('[Conversation] Context too long (>120k), using summary + recent messages');
      const existingSummary = summaries[activeConversationId];
      if (existingSummary) {
        const recentMessages = updatedMessages.slice(-RECENT_MESSAGES_COUNT);
        contextMessages = [
          {
            id: 'summary',
            conversationId: activeConversationId,
            role: 'system',
            content: `【历史对话摘要】\n${existingSummary}\n\n以上是之前对话的摘要。请基于这个摘要和下面的近期消息继续对话。`,
            contentType: 'text',
            timestamp: Date.now(),
          } as unknown as Message,
          ...recentMessages,
        ];
        hasSummaryContext = true;

        const tokensSinceSummary = recentMessages.reduce((total, m) => {
          const text = m.metadata?.imageData ? m.content + '[image]' : m.content;
          return total + estimateTokens(text);
        }, 0);

        if (tokensSinceSummary > SUMMARY_UPDATE_THRESHOLD &&
            !isGeneratingSummary &&
            updatedMessages.length > RECENT_MESSAGES_COUNT + 5) {
          console.log('[Conversation] Significant new content, updating summary in background');
          get().generateSummary(workspacePath, updatedMessages);
        }
      } else {
        contextMessages = updatedMessages.slice(-20);
      }
    }

    if (totalEstimatedTokens > SUMMARY_THRESHOLD &&
        !isGeneratingSummary &&
        !summaries[activeConversationId] &&
        updatedMessages.length > 15) {
      console.log('[Conversation] Token threshold exceeded (80k), generating initial summary');
      get().generateSummary(workspacePath, updatedMessages);
    }

    // Build messages for agent
    const history = contextMessages.map(m => {
      if (m.metadata?.imageData) {
        return {
          role: m.role as 'user' | 'assistant',
          content: [
            { type: 'image_url' as const, image_url: { url: m.metadata.imageData } },
            { type: 'text' as const, text: m.content },
          ],
        };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });

    if (hasSummaryContext) {
      console.log('[Conversation] Using summary +', contextMessages.length - 1, 'recent messages');
    } else {
      console.log('[Conversation] Using', contextMessages.length, 'messages');
    }

    // Subscribe to stream events
    if (unsubStreamEvent) unsubStreamEvent();
    unsubStreamEvent = window.electronAPI.onAIStreamEvent((event: ChatStreamEvent) => {
      get().handleStreamEvent(event);
    });

    // Generate request ID
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set({ isStreaming: true, streamingContent: '', error: null, activeRequestId: requestId, agentSteps: [] });

    try {
      await window.electronAPI.agentRun(history, { requestId, attachments, pdfContext });
    } catch (err: any) {
      set({ isStreaming: false, error: err.message || 'AI 请求失败', activeRequestId: null });
    }
  },

  stopStreaming: async () => {
    const { activeRequestId } = get();
    if (activeRequestId) {
      // Try agentStop first, then aiStop as fallback
      const stopped = await window.electronAPI.agentStop(activeRequestId);
      if (!stopped) {
        await window.electronAPI.aiStop(activeRequestId);
      }
    }
    set({ isStreaming: false, activeRequestId: null });
  },

  handleStreamEvent: (event: ChatStreamEvent) => {
    const { activeRequestId, streamingContent, agentSteps } = get();
    if (event.requestId !== activeRequestId) {
      console.log('[Renderer] Ignoring event for different request:', event.requestId);
      return;
    }

    switch (event.type) {
      case 'agent_thought':
        set({ agentSteps: [...agentSteps, { type: 'thought', content: event.thought }] });
        break;
      case 'agent_tool_call':
        set({ agentSteps: [...agentSteps, {
          type: 'tool_call',
          content: `Calling ${event.toolCall.name}...`,
          toolCall: { id: event.toolCall.id, name: event.toolCall.name, arguments: JSON.parse(event.toolCall.arguments || '{}') },
        }] });
        break;
      case 'agent_tool_result':
        set({ agentSteps: [...agentSteps, {
          type: 'tool_result',
          content: event.result,
          toolResult: { toolCallId: event.toolCallId, content: event.result, isError: event.isError },
        }] });
        break;
      case 'agent_answer':
      case 'chunk':
        if (streamingContent.length < 100) {
          console.log('[Renderer] Received chunk, content length:', event.content?.length, 'total:', streamingContent.length + (event.content?.length || 0));
        }
        set(s => ({ streamingContent: s.streamingContent + (event.content || '') }));
        break;
      case 'done': {
        console.log('[Renderer] Stream done, final content length:', get().streamingContent.length);
        const { streamingContent: finalContent, activeConversationId, currentWorkspacePath, agentSteps: finalAgentSteps } = get();
        if (finalContent && activeConversationId && currentWorkspacePath) {
          window.electronAPI.messageAdd(currentWorkspacePath, {
            conversationId: activeConversationId,
            role: 'assistant',
            content: finalContent,
            contentType: 'text',
            metadata: finalAgentSteps.length > 0 ? { agentSteps: finalAgentSteps } : undefined,
          }).then(assistantMsg => {
            set(s => ({ messages: [...s.messages, assistantMsg] }));
          });
        }
        set({ isStreaming: false, streamingContent: '', activeRequestId: null, agentSteps: [] });
        if (unsubStreamEvent) { unsubStreamEvent(); unsubStreamEvent = null; }
        break;
      }
      case 'error':
        set({ isStreaming: false, streamingContent: '', activeRequestId: null, error: event.error });
        if (unsubStreamEvent) { unsubStreamEvent(); unsubStreamEvent = null; }
        break;
    }
  },

  clearError: () => set({ error: null }),

  updateConversationTitle: async (workspacePath: string, id: string, newTitle: string) => {
    try {
      await window.electronAPI.conversationUpdate(workspacePath, id, { topic: newTitle });
      set(s => ({
        conversations: s.conversations.map(c =>
          c.id === id ? { ...c, topic: newTitle } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to update conversation title:', error);
    }
  },

  updateConversationPdfContext: async (workspacePath: string, id: string, pdfContext: import('../../shared/types').PdfContext) => {
    try {
      await window.electronAPI.conversationUpdate(workspacePath, id, { pdfContext });
      set(s => ({
        conversations: s.conversations.map(c =>
          c.id === id ? { ...c, pdfContext } : c
        ),
      }));
    } catch (error) {
      console.error('Failed to update conversation pdfContext:', error);
    }
  },
}));
