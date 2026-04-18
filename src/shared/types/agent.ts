// Agent / ReAct / Tool types

import type { ContentPart } from './ai';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AgentStep {
  type: 'thought' | 'tool_call' | 'tool_result' | 'answer';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface AgentOptions {
  requestId: string;
  model?: string;
  temperature?: number;
  maxIterations?: number;
  providerId?: string;
}
