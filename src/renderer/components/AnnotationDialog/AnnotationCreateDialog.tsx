import React, { useState } from 'react';
import { X, Highlighter, Underline } from 'lucide-react';
import type { AnnotationType } from '../../../shared/types/annotation';

interface AnnotationCreateDialogProps {
  isOpen: boolean;
  defaultType: AnnotationType;
  selectedText: string;
  onClose: () => void;
  onConfirm: (type: AnnotationType, color: string, title: string, comment: string) => void;
}

const COLORS = [
  { value: '#FCD34D', label: '黄色' },
  { value: '#F87171', label: '红色' },
  { value: '#60A5FA', label: '蓝色' },
  { value: '#34D399', label: '绿色' },
  { value: '#A78BFA', label: '紫色' },
];

export const AnnotationCreateDialog: React.FC<AnnotationCreateDialogProps> = ({
  isOpen,
  defaultType,
  selectedText,
  onClose,
  onConfirm,
}) => {
  const [type, setType] = useState<AnnotationType>(defaultType);
  const [color, setColor] = useState(defaultType === 'highlight' ? '#FCD34D' : '#3B82F6');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(type, color, title.trim(), comment.trim());
    // Reset state for next time
    setType(defaultType);
    setColor(defaultType === 'highlight' ? '#FCD34D' : '#3B82F6');
    setTitle('');
    setComment('');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-[400px] max-w-[90vw]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">添加标记</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('highlight')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm border transition-colors ${
                type === 'highlight'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Highlighter className="w-4 h-4" />
              荧光笔
            </button>
            <button
              onClick={() => setType('underline')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm border transition-colors ${
                type === 'underline'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Underline className="w-4 h-4" />
              下划线
            </button>
          </div>

          {/* Color selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              颜色
            </label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    color === c.value
                      ? 'border-gray-400 dark:border-gray-300 scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入标记标题..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Comment */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              批注（可选）
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="写下你的想法..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          {/* Selected text preview */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-3">
            {selectedText}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="px-3 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
