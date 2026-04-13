import React, { useState, useCallback, useEffect, useRef } from 'react';

interface ScreenshotCaptureProps {
  isActive: boolean;
  onCapture: (imageData: string, defaultPrompt?: string) => void;
  onCancel: () => void;
}

interface Selection {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

const ScreenshotCapture: React.FC<ScreenshotCaptureProps> = ({
  isActive, onCapture, onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [isCapturingState, setIsCapturingState] = useState(false);

  // Reset state when activated
  useEffect(() => {
    if (isActive) {
      setIsSelecting(false);
      setSelection(null);
      setStartPos({ x: 0, y: 0 });
      setIsCapturingState(false);
    }
  }, [isActive]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    // Use client coordinates (relative to viewport)
    const x = e.clientX;
    const y = e.clientY;

    setIsSelecting(true);
    setStartPos({ x, y });
    setSelection({ startX: x, startY: y, width: 0, height: 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting) return;

    // Use client coordinates
    const x = e.clientX;
    const y = e.clientY;

    const width = Math.abs(x - startPos.x);
    const height = Math.abs(y - startPos.y);
    const startX = Math.min(x, startPos.x);
    const startY = Math.min(y, startPos.y);

    setSelection({ startX, startY, width, height });
  }, [isSelecting, startPos]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !selection) return;

    setIsSelecting(false);

    // Require minimum selection size
    if (selection.width > 10 && selection.height > 10) {
      // Capture the selection
      captureSelection(selection);
    } else {
      setSelection(null);
    }
  }, [isSelecting, selection]);

  const captureSelection = async (sel: Selection) => {
    // Hide UI first to get clean screenshot
    setIsCapturingState(true);

    // Wait for React to re-render and hide the overlay
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Use window capture API which captures the app's own window content.
      // This does NOT require screen recording permission on macOS (unlike desktopCapturer).
      // Coordinates are CSS pixels (DIP) relative to the webContents viewport.
      const imageData = await window.electronAPI.captureWindowRegion({
        x: Math.round(sel.startX),
        y: Math.round(sel.startY),
        width: Math.round(sel.width),
        height: Math.round(sel.height),
      });

      // Pass image data with translation prompt
      onCapture(imageData, '请翻译图片中的内容');
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      alert('截图失败: ' + (error instanceof Error ? error.message : String(error)));
      setIsCapturingState(false);
      onCancel();
    }
  };

  // Handle keyboard cancel
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onCancel]);

  if (!isActive) return null;

  // Hide everything when capturing to get clean screenshot
  if (isCapturingState) {
    return (
      <div className="fixed inset-0 z-[9999]" style={{ backgroundColor: 'transparent' }} />
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] cursor-crosshair"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
    >
      {/* Selection rectangle */}
      {selection && (
        <div
          className="absolute border-2 border-primary-500 bg-primary-500/10 pointer-events-none"
          style={{
            left: selection.startX,
            top: selection.startY,
            width: selection.width,
            height: selection.height,
          }}
        >
          {/* Size indicator */}
          <div className="absolute -top-6 left-0 bg-primary-600 text-white text-xs px-2 py-0.5 rounded">
            {selection.width} × {selection.height}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900/80 text-white px-4 py-2 rounded-lg text-sm">
        拖拽选择区域，按 ESC 取消
      </div>
    </div>
  );
};

export default ScreenshotCapture;
