import React, { useCallback, useEffect, useState } from 'react';

interface ResizableSplitterProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  className?: string;
}

const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  direction,
  onResize,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      onResize(direction === 'horizontal' ? e.movementX : e.movementY);
    },
    [isDragging, direction, onResize]
  );

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp, direction]);

  return (
    <div
      className={`
        ${direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
        hover:bg-primary-400 active:bg-primary-500
        transition-colors duration-150
        ${isDragging ? 'bg-primary-500' : 'bg-transparent'}
        ${className}
      `}
      onMouseDown={handleMouseDown}
      style={{
        flexShrink: 0,
      }}
    >
      {/* Visual indicator on hover */}
      <div
        className={`
          ${direction === 'horizontal' ? 'w-px h-full mx-auto' : 'h-px w-full my-auto'}
          bg-gray-300 dark:bg-gray-600
          hover:bg-primary-400
          transition-colors duration-150
        `}
      />
    </div>
  );
};

export default ResizableSplitter;
