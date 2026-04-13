import React, { useEffect, useState, useCallback } from 'react';
import { Languages, HelpCircle, MessageCircle, X } from 'lucide-react';

interface SelectionToolbarProps {
  containerRef: React.RefObject<HTMLElement>;
  onTranslate: (text: string) => void;
  onExplain: (text: string) => void;
  onAsk: (text: string, prefillText?: string) => void;
}

interface Position {
  x: number;
  y: number;
}

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  containerRef,
  onTranslate,
  onExplain,
  onAsk,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState<Position | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const hideToolbar = useCallback(() => {
    setIsVisible(false);
    setSelectedText('');
    setPosition(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideToolbar();
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < 2) {
        hideToolbar();
        return;
      }

      // Check if selection is within our container
      const range = selection.getRangeAt(0);
      const containerElement = container as Node;
      if (!containerElement.contains(range.commonAncestorContainer)) {
        hideToolbar();
        return;
      }

      // Get selection position
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate position relative to viewport
      const x = rect.left + rect.width / 2;
      const y = rect.top - 50; // Position above selection

      setSelectedText(text);
      setPosition({ x, y });
      setIsVisible(true);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-toolbar')) {
        hideToolbar();
      }
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [containerRef, hideToolbar]);

  const handleAction = (action: 'translate' | 'explain' | 'ask') => {
    if (!selectedText) return;
    switch (action) {
      case 'translate':
        onTranslate(selectedText);
        break;
      case 'explain':
        onExplain(selectedText);
        break;
      case 'ask':
        // Pass prefill text to populate the input box instead of sending immediately
        const prefillText = `关于以下内容，我有几个问题:\n\n${selectedText}\n\n请帮我分析这段内容的关键点和潜在问题。`;
        onAsk(selectedText, prefillText);
        break;
    }
    hideToolbar();
    // Clear the selection
    window.getSelection()?.removeAllRanges();
  };

  if (!isVisible || !position) return null;

  return (
    <div
      className="selection-toolbar fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 px-1 flex items-center gap-0.5"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <button
        onClick={() => handleAction('translate')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="翻译"
      >
        <Languages className="w-3.5 h-3.5" />
        <span>翻译</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('explain')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="解释"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>解释</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('ask')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="提问"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>提问</span>
      </button>
    </div>
  );
};

export default SelectionToolbar;
