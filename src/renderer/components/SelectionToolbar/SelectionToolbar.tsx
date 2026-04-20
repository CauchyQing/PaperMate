import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Languages, HelpCircle, MessageCircle, Highlighter, Underline } from 'lucide-react';

interface SelectionToolbarProps {
  containerRef: React.RefObject<HTMLElement>;
  onTranslate: (text: string) => void;
  onExplain: (text: string) => void;
  onAsk: (text: string, prefillText?: string) => void;
  onHighlight?: (text: string, rects: DOMRectList) => void;
  onUnderline?: (text: string, rects: DOMRectList) => void;
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
  onHighlight,
  onUnderline,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [selectedRects, setSelectedRects] = useState<DOMRectList | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isMouseDownRef = useRef(false);

  const hideToolbar = useCallback(() => {
    setIsVisible(false);
    setSelectedText('');
    setSelectedRects(null);
    setPosition(null);
  }, []);

  // Show toolbar only after mouse is released to avoid the toolbar
  // becoming part of the selection while the user is still dragging.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tryShowToolbar = () => {
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

      const range = selection.getRangeAt(0);
      const containerElement = container as Node;
      if (!containerElement.contains(range.commonAncestorContainer)) {
        hideToolbar();
        return;
      }

      const rect = range.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top - 50; // Position above selection

      setSelectedText(text);
      setSelectedRects(range.getClientRects());
      setPosition({ x, y });
      setIsVisible(true);
    };

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

      const range = selection.getRangeAt(0);
      const containerElement = container as Node;
      if (!containerElement.contains(range.commonAncestorContainer)) {
        hideToolbar();
        return;
      }

      // Cache selection data during drag, but do NOT show the toolbar
      // while the mouse is still down. Showing it mid-drag on Windows
      // causes the cursor to intersect the toolbar, making the selection
      // jump / flicker as the toolbar DOM is included in the selection.
      setSelectedText(text);
      setSelectedRects(range.getClientRects());

      if (!isMouseDownRef.current) {
        const rect = range.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top - 50;
        setPosition({ x, y });
        setIsVisible(true);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      isMouseDownRef.current = true;
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-toolbar')) {
        hideToolbar();
      }
    };

    const handleMouseUp = () => {
      isMouseDownRef.current = false;
      // Use rAF so the browser finishes updating the selection range
      requestAnimationFrame(() => {
        tryShowToolbar();
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [containerRef, hideToolbar]);

  const handleAction = (action: 'translate' | 'explain' | 'ask' | 'highlight' | 'underline') => {
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
      case 'highlight':
        if (selectedRects) {
          onHighlight?.(selectedText, selectedRects);
        }
        break;
      case 'underline':
        if (selectedRects) {
          onUnderline?.(selectedText, selectedRects);
        }
        break;
    }
    hideToolbar();
    // Clear the selection
    window.getSelection()?.removeAllRanges();
  };

  if (!isVisible || !position) return null;

  return (
    <div
      className="selection-toolbar fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 px-1 flex items-center gap-0.5 select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
        userSelect: 'none',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <button
        onClick={() => handleAction('translate')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors select-none"
        title="翻译"
      >
        <Languages className="w-3.5 h-3.5" />
        <span>翻译</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('explain')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors select-none"
        title="解释"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        <span>解释</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('ask')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors select-none"
        title="提问"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        <span>提问</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('highlight')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors select-none"
        title="荧光笔"
      >
        <Highlighter className="w-3.5 h-3.5 text-yellow-500" />
        <span>高亮</span>
      </button>
      <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-0.5" />
      <button
        onClick={() => handleAction('underline')}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors select-none"
        title="下划线"
      >
        <Underline className="w-3.5 h-3.5 text-blue-500" />
        <span>划线</span>
      </button>
    </div>
  );
};

export default SelectionToolbar;
