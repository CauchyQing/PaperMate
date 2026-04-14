// AI Provider and Chat types

export interface AIProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  maxTokens?: number;
  supportsVision?: boolean;
}

export interface PresetProvider {
  name: string;
  baseUrl: string;
  models: string[];
  defaultModel: string;
  supportsVision: boolean;
}

export const PRESET_PROVIDERS: PresetProvider[] = [
  {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    defaultModel: 'gpt-4o-mini',
    supportsVision: true,
  },
  {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    supportsVision: false,
  },
  {
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: [],
    defaultModel: '',
    supportsVision: false,
  },
  {
    name: '自定义',
    baseUrl: '',
    models: [],
    defaultModel: '',
    supportsVision: false,
  },
];

// Chat message types (OpenAI compatible)
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatStreamEventBase {
  requestId: string;
}

export interface ChatStreamChunkEvent extends ChatStreamEventBase {
  type: 'chunk';
  content?: string;
}

export interface ChatStreamDoneEvent extends ChatStreamEventBase {
  type: 'done';
}

export interface ChatStreamErrorEvent extends ChatStreamEventBase {
  type: 'error';
  error: string;
}

export interface AgentThoughtEvent extends ChatStreamEventBase {
  type: 'agent_thought';
  thought: string;
}

export interface AgentToolCallEvent extends ChatStreamEventBase {
  type: 'agent_tool_call';
  toolCall: { id: string; name: string; arguments: string };
}

export interface AgentToolResultEvent extends ChatStreamEventBase {
  type: 'agent_tool_result';
  toolCallId: string;
  result: string;
  isError: boolean;
}

export interface AgentAnswerEvent extends ChatStreamEventBase {
  type: 'agent_answer';
  content: string;
}

export type ChatStreamEvent =
  | ChatStreamChunkEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent
  | AgentThoughtEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentAnswerEvent;

// Paper analysis result
export interface PaperAnalysis {
  suggestedTitle: string;
  suggestedJournal?: string;
  suggestedYear?: number;
  suggestedTopics: string[];
  suggestedKeywords: string[];
  summary: string;
}
