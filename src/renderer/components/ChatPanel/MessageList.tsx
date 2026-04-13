import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { User, Bot } from 'lucide-react';
import type { Message } from '../../../shared/types';

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
}

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasImage = message.metadata?.imageData;
  return (
    <div className={`flex gap-2 px-3 py-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-700'
      }`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
          : <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
        }
      </div>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
        isUser
          ? 'bg-primary-600 text-white'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
      }`}>
        {hasImage && (
          <img
            src={message.metadata?.imageData}
            alt="图片"
            className="max-h-32 w-auto rounded-lg mb-2 border border-white/30"
          />
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-code:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};

const StreamingBubble: React.FC<{ content: string }> = ({ content }) => (
  <div className="flex gap-2 px-3 py-2">
    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-700">
      <Bot className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
    </div>
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
      {content ? (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-code:text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {content}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  </div>
);
const MessageList: React.FC<MessageListProps> = ({ messages, isStreaming, streamingContent }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
        <Bot className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          发送消息开始对话
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          可以翻译论文、分析文献、回答问题
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {isStreaming && <StreamingBubble content={streamingContent} />}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
