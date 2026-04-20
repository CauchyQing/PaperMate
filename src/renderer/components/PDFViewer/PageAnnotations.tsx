import React, { useMemo } from 'react';
import type { Annotation } from '../../../shared/types/annotation';

interface PageAnnotationsProps {
  annotations: Annotation[];
  scale: number;
  onAnnotationClick?: (
    annotation: Annotation,
    rect: { left: number; top: number; width: number; height: number }
  ) => void;
}

export const PageAnnotations: React.FC<PageAnnotationsProps> = ({
  annotations,
  scale,
  onAnnotationClick,
}) => {
  const renderedAnnotations = useMemo(() => {
    return annotations.flatMap((annotation) => {
      const scaleRatio = scale / annotation.createdScale;
      return annotation.rects.map((rect, idx) => {
        const scaledRect = {
          left: rect.left * scaleRatio,
          top: rect.top * scaleRatio,
          width: rect.width * scaleRatio,
          height: rect.height * scaleRatio,
        };
        const style: React.CSSProperties = {
          position: 'absolute',
          left: scaledRect.left,
          top: scaledRect.top,
          width: scaledRect.width,
          height: scaledRect.height,
          backgroundColor: annotation.type === 'highlight' ? annotation.color : 'transparent',
          borderBottom: annotation.type === 'underline' ? `2px solid ${annotation.color}` : 'none',
          opacity: annotation.type === 'highlight' ? 0.4 : 1,
          pointerEvents: 'auto',
          cursor: 'pointer',
          zIndex: 10,
          /* mixBlendMode removed: on Windows/Electron it can trigger
             GPU compositing bugs that make text-selection highlights
             flicker and jump. Plain opacity is sufficient. */
        };
        return (
          <div
            key={`${annotation.id}-${idx}`}
            style={style}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationClick?.(annotation, scaledRect);
            }}
            title={annotation.title || annotation.comment || undefined}
          />
        );
      });
    });
  }, [annotations, scale, onAnnotationClick]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {renderedAnnotations}
    </div>
  );
};
