import type { ToolDefinition, ToolCall, ToolResult } from '../../shared/types/agent';

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const registry = new Map<string, RegisteredTool>();

export function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
  registry.set(definition.name, { definition, handler });
}

export function getTool(name: string): RegisteredTool | undefined {
  return registry.get(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(registry.values()).map(t => t.definition);
}

export function listToolsByNames(names: string[]): ToolDefinition[] {
  const defs: ToolDefinition[] = [];
  for (const name of names) {
    const tool = registry.get(name);
    if (tool) defs.push(tool.definition);
  }
  return defs;
}

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = getTool(call.name);
  if (!tool) {
    return {
      toolCallId: call.id,
      content: `Tool "${call.name}" not found.`,
      isError: true,
    };
  }
  try {
    const result = await tool.handler(call.arguments);
    return { toolCallId: call.id, content: result, isError: false };
  } catch (err: any) {
    return { toolCallId: call.id, content: err.message || String(err), isError: true };
  }
}
