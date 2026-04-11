import { create } from 'zustand';
import type { Conversation, Message } from '../../shared/types';
import type { ChatStreamEvent } from '../../shared/types/ai';

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

  // Actions
  loadConversations: (workspacePath: string) => Promise<void>;
  createConversation: (workspacePath: string, data: Partial<Conversation>) => Promise<Conversation>;
  deleteConversation: (workspacePath: string, id: string) => Promise<void>;
  setActiveConversation: (workspacePath: string, id: string | null) => Promise<void>;
  sendMessage: (workspacePath: string, content: string, metadata?: Message['metadata']) => Promise<void>;
  stopStreaming: () => Promise<void>;
  handleStreamEvent: (event: ChatStreamEvent) => void;
  clearError: () => void;
}

let unsubStreamEvent: (() => void) | null = null;

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
      return {
        conversations,
        activeConversationId: needSwitch ? (conversations[0]?.id || null) : s.activeConversationId,
        messages: needSwitch ? [] : s.messages,
      };
    });
  },

  setActiveConversation: async (workspacePath: string, id: string | null) => {
    set({ activeConversationId: id, messages: [], streamingContent: '' });
    if (id) {
      const messages = await window.electronAPI.messageList(workspacePath, id);
      set({ messages });
    }
  },

  sendMessage: async (workspacePath: string, content: string, metadata?: Message['metadata']) => {
    const { activeConversationId } = get();
    if (!activeConversationId) return;

    // Save user message
    const userMsg = await window.electronAPI.messageAdd(workspacePath, {
      conversationId: activeConversationId,
      role: 'user',
      content,
      contentType: metadata?.imageData ? 'mixed' : 'text',
      metadata,
    });
    set(s => ({ messages: [...s.messages, userMsg] }));

    // Build messages array for AI
    const history = get().messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Subscribe to stream events
    if (unsubStreamEvent) unsubStreamEvent();
    unsubStreamEvent = window.electronAPI.onAIStreamEvent((event: ChatStreamEvent) => {
      get().handleStreamEvent(event);
    });

    set({ isStreaming: true, streamingContent: '', error: null });

    try {
      const requestId = await window.electronAPI.aiChat(history);
      set({ activeRequestId: requestId });
    } catch (err: any) {
      set({ isStreaming: false, error: err.message || 'AI 请求失败' });
    }
  },

  stopStreaming: async () => {
    const { activeRequestId } = get();
    if (activeRequestId) {
      await window.electronAPI.aiStop(activeRequestId);
    }
    set({ isStreaming: false, activeRequestId: null });
  },

  handleStreamEvent: (event: ChatStreamEvent) => {
    const { activeRequestId } = get();
    if (event.requestId !== activeRequestId) return;

    switch (event.type) {
      case 'chunk':
        set(s => ({ streamingContent: s.streamingContent + (event.content || '') }));
        break;
      case 'done': {
        const { streamingContent, activeConversationId, currentWorkspacePath } = get();
        if (streamingContent && activeConversationId && currentWorkspacePath) {
          window.electronAPI.messageAdd(currentWorkspacePath, {
              conversationId: activeConversationId,
              role: 'assistant',
              content: streamingContent,
              contentType: 'text',
            }).then(assistantMsg => {
              set(s => ({ messages: [...s.messages, assistantMsg] }));
            });
        }
        set({ isStreaming: false, streamingContent: '', activeRequestId: null });
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
}));
