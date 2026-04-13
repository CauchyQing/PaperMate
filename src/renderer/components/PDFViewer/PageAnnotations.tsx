import React, { useMemo } from 'react';
import type { Annotation } from '../../../shared/types/annotation';

interface PageAnnotationsProps {
  annotations: Annotation[];
  scale: number;
  onAnnotationClick?: (annotation: Annotation) => void;
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
        const style: React.CSSProperties = {
          position: 'absolute',
          left: rect.left * scaleRatio,
          top: rect.top * scaleRatio,
          width: rect.width * scaleRatio,
          height: rect.height * scaleRatio,
          backgroundColor: annotation.type === 'highlight' ? annotation.color : 'transparent',
          borderBottom: annotation.type === 'underline' ? `2px solid ${annotation.color}` : 'none',
          opacity: annotation.type === 'highlight' ? 0.4 : 1,
          pointerEvents: 'auto',
          cursor: 'pointer',
          zIndex: 10,
          mixBlendMode: annotation.type === 'highlight' ? 'multiply' : undefined,
        };
        return (
          <div
            key={`${annotation.id}-${idx}`}
            style={style}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationClick?.(annotation);
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
