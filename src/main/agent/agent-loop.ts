import { chatStreamGenerator } from '../services/ai-service';
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
  const rawInput = lastUserMessage?.content || '';
  const userInput = typeof rawInput === 'string' 
    ? rawInput 
    : (Array.isArray(rawInput) ? rawInput.map(p => p.text || '').join('\n') : '');
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

    const generator = chatStreamGenerator(messages, {
      temperature: options.temperature ?? 0.3,
      providerId: options.providerId,
      signal: options.signal,
    });

    let fullResponse = '';
    let parsed: any = {};
    let isStreamingAnswer = false;
    let answerBuffer = '';

    try {
      for await (const chunk of generator) {
        if (options.signal?.aborted) {
          options.onEvent({ type: 'error', error: 'Agent execution was cancelled.', requestId: options.requestId });
          return;
        }

        fullResponse += chunk;

        if (!isStreamingAnswer) {
          const answerMatch = fullResponse.match(/<answer>([\s\S]*)$/i);
          if (answerMatch) {
            isStreamingAnswer = true;
            
            // Extract thought if available before answer
            const thoughtMatches = Array.from(fullResponse.matchAll(/<thought>([\s\S]*?)<\/thought>/gi));
            if (thoughtMatches.length > 0) {
              parsed.thought = thoughtMatches.map(m => m[1].trim()).join('\n\n');
              options.onEvent({ type: 'agent_thought', thought: parsed.thought, requestId: options.requestId });
            }

            options.onEvent({ type: 'agent_answer', content: '', requestId: options.requestId });
            
            // Re-evaluate safe streaming with the new content
            const rawContent = answerMatch[1];
            let safeContent = rawContent;
            
            const closingTagIndex = rawContent.indexOf('</answer>');
            if (closingTagIndex !== -1) {
              safeContent = rawContent.substring(0, closingTagIndex);
            } else {
              // Strip trailing partial tags to prevent streaming them early
              const suffixes = ['<', '</', '</a', '</an', '</ans', '</answ', '</answe', '</answer'];
              for (const suffix of suffixes) {
                if (rawContent.endsWith(suffix)) {
                  safeContent = rawContent.substring(0, rawContent.length - suffix.length);
                  break;
                }
              }
            }

            if (safeContent) {
              options.onEvent({ type: 'chunk', content: safeContent, requestId: options.requestId });
              answerBuffer = safeContent;
            }
          }
        } else {
          // We are inside answer, stream safe portion of answer string
          const answerMatch = fullResponse.match(/<answer>([\s\S]*)$/i);
          if (answerMatch) {
            const rawContent = answerMatch[1];
            let safeContent = rawContent;
            let foundClosingTag = false;
            
            const closingTagIndex = rawContent.indexOf('</answer>');
            if (closingTagIndex !== -1) {
              safeContent = rawContent.substring(0, closingTagIndex);
              foundClosingTag = true;
            } else {
              const suffixes = ['<', '</', '</a', '</an', '</ans', '</answ', '</answe', '</answer'];
              for (const suffix of suffixes) {
                if (rawContent.endsWith(suffix)) {
                  safeContent = rawContent.substring(0, rawContent.length - suffix.length);
                  break;
                }
              }
            }

            if (safeContent.length > answerBuffer.length) {
              const newContent = safeContent.substring(answerBuffer.length);
              options.onEvent({ type: 'chunk', content: newContent, requestId: options.requestId });
              answerBuffer = safeContent;
            }

            if (foundClosingTag) {
              break;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        options.onEvent({ type: 'error', error: 'Agent execution was cancelled.', requestId: options.requestId });
        return;
      }
      options.onEvent({ type: 'error', error: err.message || '未知错误', requestId: options.requestId });
      return;
    }

    if (!isStreamingAnswer) {
      // Not an answer, must be a tool call (or incomplete)
      const thoughtMatches = Array.from(fullResponse.matchAll(/<thought>([\s\S]*?)<\/thought>/gi));
      if (thoughtMatches.length > 0) {
        parsed.thought = thoughtMatches.map(m => m[1].trim()).join('\n\n');
        options.onEvent({ type: 'agent_thought', thought: parsed.thought, requestId: options.requestId });
      }

      const lastOpenIndex = fullResponse.lastIndexOf('<tool_call>');
      if (lastOpenIndex !== -1) {
        const closeIndex = fullResponse.indexOf('</tool_call>', lastOpenIndex);
        let toolCallText = closeIndex !== -1 
          ? fullResponse.substring(lastOpenIndex + 11, closeIndex).trim()
          : fullResponse.substring(lastOpenIndex + 11).trim();

        if (toolCallText) {
          try {
            const jsonMatch = toolCallText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : toolCallText;
            parsed.tool_call = JSON.parse(jsonStr);
          } catch (e) {
            console.error('[Agent] Failed to parse tool_call JSON from last tag:', e);
          }
        }
      }
    }

    // Push the full assistant output to context so the LLM remembers its own tool call or answer
    const assistantMsg: AgentMessage = { role: 'assistant', content: fullResponse.trim() };
    messages.push(assistantMsg);

    if (isStreamingAnswer) {
      options.onEvent({ type: 'done', requestId: options.requestId });
      return;
    }

    // Execute tool
    if (parsed.tool_call) {
      const call = parsed.tool_call as ToolCall;
      options.onEvent({ type: 'agent_tool_call', toolCall: { id: call.id, name: call.name, arguments: JSON.stringify(call.arguments || {}) }, requestId: options.requestId });

      // Check if tool is allowed
      if (allowedToolNames.length > 0 && !allowedToolNames.includes(call.name)) {
        const err = `Tool "${call.name}" is not allowed by the active skills. Allowed tools: ${allowedToolNames.join(', ')}`;
        options.onEvent({ type: 'agent_tool_result', toolCallId: call.id, result: err, isError: true, requestId: options.requestId });
        messages.push({ role: 'user', content: `[Tool Result (${call.name})]:\n${err}` });
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
        messages.push({ role: 'user', content: `[Tool Result (${call.name})]:\n${cachedResult.content}` });
        continue;
      }

      const result = await executeTool(call);
      options.onEvent({ type: 'agent_tool_result', toolCallId: call.id, result: result.content, isError: result.isError || false, requestId: options.requestId });
      messages.push({ role: 'user', content: `[Tool Result (${call.name})]:\n${result.content}` });
      continue;
    }

    // If neither answer nor tool_call was found (e.g. LLM failed to follow format)
    if (!isStreamingAnswer && !parsed.tool_call) {
      const fallbackAnswer = fullResponse.trim();
      if (fallbackAnswer) {
        options.onEvent({ type: 'agent_answer', content: '', requestId: options.requestId });
        // simulate stream for fallback
        const chunks = splitTextIntoChunks(fallbackAnswer);
        for (const c of chunks) {
          options.onEvent({ type: 'chunk', content: c, requestId: options.requestId });
        }
        options.onEvent({ type: 'done', requestId: options.requestId });
        return;
      }
    }
  }

  options.onEvent({ type: 'error', error: 'Agent reached maximum number of iterations without producing a final answer.', requestId: options.requestId });
}

/**
 * Split text into small chunks for simulated streaming.
 * CJK characters are emitted 1-2 at a time; others up to 15 chars.
 */
function splitTextIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    // CJK character
    if (/[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(text[i])) {
      const size = Math.min(2, text.length - i);
      chunks.push(text.slice(i, i + size));
      i += size;
    } else {
      let end = Math.min(i + 15, text.length);
      // Try to break at a word boundary for better readability
      if (end < text.length) {
        while (end > i + 1 && !/[\s.,!?;:]/.test(text[end - 1])) {
          end--;
        }
        if (end === i + 1) end = Math.min(i + 15, text.length);
      }
      chunks.push(text.slice(i, end));
      i = end;
    }
  }
  return chunks;
}
