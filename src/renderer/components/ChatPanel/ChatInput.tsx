import React, { useState, useRef, useCallback } from 'react';
import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string) => void;
  isStreaming: boolean;
  onStop: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isStreaming, onStop }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Shift+Enter 换行)"
          rows={1}
          className="flex-1 resize-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-gray-400"
          style={{ maxHeight: 120 }}
        />
        {isStreaming ? (
          <button onClick={onStop}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex-shrink-0"
            title="停止生成">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSend}
            disabled={!input.trim()}
            className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex-shrink-0"
            title="发送">
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
