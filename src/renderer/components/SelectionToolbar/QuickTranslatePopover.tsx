import React, { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface QuickTranslatePopoverProps {
  text: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export const QuickTranslatePopover: React.FC<QuickTranslatePopoverProps> = ({ text, position, onClose }) => {
  const [translation, setTranslation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const requestId = `translate_${Date.now()}_${Math.random()}`;

    const translate = async () => {
      setIsLoading(true);
      setError(null);
      setTranslation('');

      try {
        const messages = [
          { role: 'system' as const, content: '你是一个专业的词典。请直接给出以下单词或短语的中文翻译和词性，不需要任何多余的解释。如果有多重含义，请简明扼要地列出最常见的几个。' },
          { role: 'user' as const, content: text }
        ];

        let currentTranslation = '';
        
        const unsub = window.electronAPI.onAIStreamEvent((event: any) => {
          if (event.requestId !== requestId) return;
          
          if (event.type === 'chunk' && event.content) {
            currentTranslation += event.content;
            if (isMounted) setTranslation(currentTranslation);
          } else if (event.type === 'error') {
            if (isMounted) setError(event.error || '翻译失败');
            if (isMounted) setIsLoading(false);
          } else if (event.type === 'done') {
            if (isMounted) {
              if (currentTranslation === '') {
                setError('AI 未返回任何翻译结果');
              }
              setIsLoading(false);
            }
          }
        });

        // When stream: true, aiChat returns the requestId, not the content.
        // The content is handled by the onAIStreamEvent listener above.
        await window.electronAPI.aiChat(messages, { requestId, stream: true });
        
        // No need to setTranslation(result) here as it would just be the requestId string.

        return () => {
          unsub();
        };

      } catch (err: any) {
        if (isMounted) {
          setError(err.message || '翻译请求失败');
          setIsLoading(false);
        }
      }
    };

    const cleanup = translate();

    return () => {
      isMounted = false;
      cleanup.then(fn => fn && fn());
      window.electronAPI.aiStop?.(requestId).catch(() => {});
    };
  }, [text]);

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-64 text-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%) translateY(10px)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <span className="font-medium text-gray-800 dark:text-gray-200 truncate pr-2 flex-1" title={text}>
          {text}
        </span>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 -mr-1 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-3 max-h-48 overflow-y-auto">
        {isLoading && !translation ? (
          <div className="flex items-center justify-center py-4 space-x-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
            <span>正在翻译...</span>
          </div>
        ) : error && !translation ? (
          <div className="text-red-500 py-2 text-center">{error}</div>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {translation}
            {isLoading && <span className="inline-block w-1.5 h-3.5 ml-1 bg-gray-400 animate-pulse align-middle" />}
          </div>
        )}
      </div>
    </div>
  );
};
