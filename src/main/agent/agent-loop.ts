import { chatSync } from '../services/ai-service';
import { executeTool, listToolsByNames, listTools } from './tool-registry';
import { buildAgentSystemPrompt, getAllowedToolsFromSkills, loadAllSkills, selectSkills } from '../skills/runtime';
import { setCachedSkills } from '../skills/registry';
import type { AgentMessage, AgentOptions, ToolCall } from '../../shared/types/agent';
import type { ChatStreamEvent } from '../../shared/types/ai';
import type { PdfContext } from '../../shared/types';

// Import tools so they self-register
import './tools/pdf-extract';
import './tools/bash';
import './tools/cdp-bridge';
import './tools/web-search';

function toolDefinitionToJsonString(tools: ReturnType<typeof listToolsByNames>): string {
  return tools.map(t => `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters, null, 2)}`).join('\n');
}

export type AgentEventHandler = (event: ChatStreamEvent) => void;

export async function runAgentLoop(
  userMessages: AgentMessage[],
  options: AgentOptions & { onEvent: AgentEventHandler; signal?: AbortSignal; attachments?: Array<{ type: string; path: string; name: string }>; pdfContext?: PdfContext }
): Promise<void> {
  // Load all skills on first run (cache them)
  let skills = await loadAllSkills();
  setCachedSkills(skills);

  // Select relevant skills based on last user message
  const lastUserMessage = [...userMessages].reverse().find(m => m.role === 'user');
  const userInput = lastUserMessage?.content || '';
  const selectedSkills = selectSkills(userInput, skills, options.attachments);
  console.log('[Agent] Selected skills:', selectedSkills.map(s => s.name));

  // Build system prompt with selected skills
  const systemPrompt = buildAgentSystemPrompt(selectedSkills);
  const allowedToolNames = getAllowedToolsFromSkills(selectedSkills);
  // If no skills selected or skills don't restrict tools, allow all registered tools
  const availableTools = allowedToolNames.length > 0 ? listToolsByNames(allowedToolNames) : listTools();

  const toolSection = availableTools.length > 0
    ? `\n\n--- 可用工具 ---\n${toolDefinitionToJsonString(availableTools)}`
    : '';

  let pdfSection = '';
  if (options.pdfContext?.structuredSummary) {
    pdfSection = `\n\n--- 当前对话关联的 PDF 论文 ---\n文件名: ${options.pdfContext.fileName}\n\n结构化摘要:\n${options.pdfContext.structuredSummary}\n\n你可以基于以上摘要回答用户问题。如果用户询问非常细节的内容（如具体公式、图表、某段实验数据），你可以使用 pdf_extract 工具重新提取原文。`;
  } else if (options.pdfContext?.extractedText) {
    pdfSection = `\n\n--- 当前对话关联的 PDF 论文 ---\n文件名: ${options.pdfContext.fileName}\n\n提取文本:\n${options.pdfContext.extractedText.slice(0, 4000)}`;
  }

  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt + toolSection + pdfSection },
    ...userMessages,
  ];

  const maxIterations = options.maxIterations || 15;
  for (let i = 0; i < maxIterations; i++) {
    if (options.signal?.aborted) {
      options.onEvent({ type: 'error', error: 'Agent execution was cancelled.', requestId: options.requestId });
      return;
    }

    const response = await chatSync(messages, {
      temperature: options.temperature ?? 0.3,
      providerId: options.providerId,
    });

    let parsed: any;
    try {
      // Try to extract JSON from markdown code blocks or plain text
      const trimmed = response.trim();
      const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        parsed = JSON.parse(codeBlockMatch[1].trim());
      } else {
        // Find all top-level JSON object candidates and try parsing from the last one
        // (the last one is usually the most complete when model emits multiple JSONs)
        const candidates: string[] = [];
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === '{') {
            let depth = 0;
            for (let j = i; j < trimmed.length; j++) {
              if (trimmed[j] === '{') depth++;
              else if (trimmed[j] === '}') depth--;
              if (depth === 0) {
                candidates.push(trimmed.slice(i, j + 1));
                i = j;
                break;
              }
            }
          }
        }
        let found = false;
        for (let k = candidates.length - 1; k >= 0; k--) {
          try {
            parsed = JSON.parse(candidates[k]);
            found = true;
            break;
          } catch {
            continue;
          }
        }
        if (!found) {
          parsed = { answer: response.trim() };
        }
      }
    } catch {
      parsed = { answer: response.trim() };
    }

    // Emit thought
    if (parsed.thought) {
      options.onEvent({ type: 'agent_thought', thought: parsed.thought, requestId: options.requestId });
      messages.push({ role: 'assistant', content: parsed.thought });
    }

    // Execute tool
    if (parsed.tool_call) {
      const call = parsed.tool_call as ToolCall;
      if (!call.id) call.id = `call_${Date.now()}`;
      options.onEvent({ type: 'agent_tool_call', toolCall: { id: call.id, name: call.name, arguments: JSON.stringify(call.arguments || {}) }, requestId: options.requestId });

      // Check if tool is allowed
      if (allowedToolNames.length > 0 && !allowedToolNames.includes(call.name)) {
        const err = `Tool "${call.name}" is not allowed by the active skills. Allowed tools: ${allowedToolNames.join(', ')}`;
        options.onEvent({ type: 'agent_tool_result', toolCallId: call.id, result: err, isError: true, requestId: options.requestId });
        messages.push({ role: 'tool', content: err, tool_call_id: call.id });
        continue;
      }

      // Short-circuit pdf_extract if we already have cached extractedText for the same file
      if (call.name === 'pdf_extract' && options.pdfContext?.extractedText && options.pdfContext.filePath === call.arguments.filePath) {
        const cachedResult = {
          toolCallId: call.id,
          content: `[Using cached PDF text]\n${options.pdfContext.extractedText}`,
          isError: false,
        };
        options.onEvent({ type: 'agent_tool_result', toolCallId: call.id, result: cachedResult.content, isError: false, requestId: options.requestId });
        messages.push({ role: 'tool', content: cachedResult.content, tool_call_id: call.id });
        continue;
      }

      const result = await executeTool(call);
      options.onEvent({ type: 'agent_tool_result', toolCallId: call.id, result: result.content, isError: result.isError || false, requestId: options.requestId });
      messages.push({ role: 'tool', content: result.content, tool_call_id: call.id });
      continue;
    }

    // Final answer
    if (parsed.answer) {
      // Heuristic: if answer looks like an intermediate step, treat as thought and continue
      const intermediatePatterns = ['正在', '准备', '现在', '接下来', '先', '加载', '提取', '搜索中', '请稍候', '页面已', '已经打开', '正在查看'];
      const looksIntermediate = intermediatePatterns.some(p => String(parsed.answer).includes(p)) && String(parsed.answer).length < 120;

      if (looksIntermediate && i < maxIterations - 1) {
        options.onEvent({ type: 'agent_thought', thought: parsed.answer, requestId: options.requestId });
        messages.push({ role: 'assistant', content: parsed.answer });
        messages.push({ role: 'system', content: '你还没有完成任务。刚才的输出只是一个中间状态，请继续调用工具获取最终结果，然后给出最终答案。' });
        continue;
      }

      options.onEvent({ type: 'agent_answer', content: parsed.answer, requestId: options.requestId });
      options.onEvent({ type: 'chunk', content: parsed.answer, requestId: options.requestId });
      options.onEvent({ type: 'done', requestId: options.requestId });
      return;
    }

    // If only thought was provided without tool_call or answer, nudge to continue
    if (parsed.thought && i < maxIterations - 1) {
      messages.push({ role: 'system', content: '请继续：如果你还需要调用工具，请输出 tool_call；如果你已经可以回答用户，请输出 answer。' });
      continue;
    }

    // Fallback: if no recognized fields, treat as answer
    const fallbackAnswer = response.trim();
    options.onEvent({ type: 'agent_answer', content: fallbackAnswer, requestId: options.requestId });
    options.onEvent({ type: 'chunk', content: fallbackAnswer, requestId: options.requestId });
    options.onEvent({ type: 'done', requestId: options.requestId });
    return;
  }

  options.onEvent({ type: 'error', error: 'Agent reached maximum number of iterations without producing a final answer.', requestId: options.requestId });
}
