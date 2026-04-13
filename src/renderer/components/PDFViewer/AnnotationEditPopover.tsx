import React, { useState, useEffect, useRef } from 'react';
import { GripHorizontal, Trash2, Check } from 'lucide-react';
import type { Annotation } from '../../../shared/types/annotation';

interface AnnotationEditPopoverProps {
  annotation: Annotation;
  rect: { left: number; top: number; width: number; height: number };
  onSave: (id: string, title: string, comment: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const AnnotationEditPopover: React.FC<AnnotationEditPopoverProps> = ({
  annotation,
  rect,
  onSave,
  onDelete,
  onClose,
}) => {
  const [title, setTitle] = useState(annotation.title || '');
  const [comment, setComment] = useState(annotation.comment || '');

  // Draggable position
  const initialLeft = rect.left + rect.width + 8;
  const initialTop = rect.top;
  const [pos, setPos] = useState({ left: initialLeft, top: initialTop });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setPos({
        left: e.clientX - dragOffsetRef.current.x,
        top: e.clientY - dragOffsetRef.current.y,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragOffsetRef.current = {
      x: e.clientX - pos.left,
      y: e.clientY - pos.top,
    };
  };

  return (
    <div
      ref={popoverRef}
      className="annotation-edit-popover absolute z-50 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 pointer-events-auto"
      style={{
        left: pos.left,
        top: pos.top,
        borderColor: annotation.color,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Color header bar with drag handle */}
      <div
        className="rounded-t-md cursor-move flex items-center justify-center"
        style={{ backgroundColor: annotation.color, height: '18px' }}
        onMouseDown={startDrag}
      >
        <GripHorizontal className="w-4 h-4 text-white/80" />
      </div>

      <div className="p-3 space-y-3">
        {/* Title input */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            标题
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入标题..."
            className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Comment input */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            批注
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="写下你的想法..."
            rows={3}
            className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-gray-100 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => onDelete(annotation.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => onSave(annotation.id, title, comment)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
