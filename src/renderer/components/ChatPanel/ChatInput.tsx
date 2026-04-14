import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Square, X, Image as ImageIcon, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSend: (content: string, imageData?: string) => void;
  isStreaming: boolean;
  onStop: () => void;
  pendingImage?: string | null;
  onClearImage?: () => void;
  initialText?: string;
  pendingAttachment?: { name: string; path: string } | null;
  onClearAttachment?: () => void;
  onSelectAttachment?: () => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isStreaming,
  onStop,
  pendingImage,
  onClearImage,
  initialText = '',
  pendingAttachment,
  onClearAttachment,
  onSelectAttachment,
}) => {
  const [input, setInput] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update input when initialText changes (e.g. when screenshot prompt is set)
  useEffect(() => {
    if (initialText) {
      setInput(initialText);
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    }
  }, [initialText]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && !pendingImage && !pendingAttachment) || isStreaming) return;
    onSend(trimmed, pendingImage || undefined);
    setInput('');
    onClearImage?.();
    onClearAttachment?.();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend, pendingImage, pendingAttachment, onClearImage, onClearAttachment]);

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
      {/* Pending Image Preview */}
      {pendingImage && (
        <div className="mb-2 relative inline-block">
          <img
            src={pendingImage}
            alt="截图预览"
            className="h-16 w-auto rounded-lg border border-gray-300 dark:border-gray-600"
          />
          <button
            onClick={onClearImage}
            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
            title="删除图片"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {/* Pending Attachment Preview */}
      {pendingAttachment && (
        <div className="mb-2 inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-200">
          <Paperclip className="w-3 h-3" />
          <span className="max-w-[200px] truncate">{pendingAttachment.name}</span>
          <button
            onClick={onClearAttachment}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            title="删除附件"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onSelectAttachment}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="添加 PDF 附件"
          >
            <Paperclip className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={pendingImage ? "输入消息（可选）..." : "输入消息... (Shift+Enter 换行)"}
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
            disabled={!input.trim() && !pendingImage && !pendingAttachment}
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
