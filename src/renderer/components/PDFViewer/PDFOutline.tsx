import React, { useState } from 'react';
import { ChevronRight, ChevronDown, BookOpen } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PDFOutline = Awaited<ReturnType<PDFDocumentProxy['getOutline']>>;
type PDFOutlineItem = PDFOutline[number];

interface PDFOutlineProps {
  outline: PDFOutline | null;
  pdf?: PDFDocumentProxy | false;
  onItemClick: (pageNumber: number) => void;
}

const OutlineTreeItem: React.FC<{
  item: PDFOutlineItem;
  level: number;
  pdf?: PDFDocumentProxy | false;
  onItemClick: (pageNumber: number) => void;
}> = ({ item, level, pdf, onItemClick }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = item.items && item.items.length > 0;
  const paddingLeft = level * 12 + 8;

  const handleClick = async () => {
    if (!pdf) return;
    try {
      let dest = item.dest;
      if (typeof dest === 'string') {
        dest = await pdf.getDestination(dest);
      }
      if (Array.isArray(dest) && dest.length > 0) {
        const pageIndex = await pdf.getPageIndex(dest[0] as any);
        onItemClick(pageIndex + 1);
      }
    } catch (err) {
      console.error('[PDFOutline] Failed to resolve destination:', err);
    }
  };

  return (
    <li className="select-none">
      <div
        className="flex items-center gap-1 py-1 pr-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded mx-1 text-gray-700 dark:text-gray-300"
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((v) => !v);
            }}
            className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span
          className="text-sm truncate flex-1"
          onClick={handleClick}
          title={item.title}
        >
          {item.title}
        </span>
      </div>
      {hasChildren && isExpanded && (
        <ul>
          {item.items!.map((child, idx) => (
            <OutlineTreeItem
              key={idx}
              item={child}
              level={level + 1}
              pdf={pdf}
              onItemClick={onItemClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

const PDFOutline: React.FC<PDFOutlineProps> = ({ outline, pdf, onItemClick }) => {
  if (!outline || outline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400 px-4 text-center">
        <BookOpen className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-xs">该 PDF 没有目录信息</p>
      </div>
    );
  }

  return (
    <ul className="py-2">
      {outline.map((item, idx) => (
        <OutlineTreeItem
          key={idx}
          item={item}
          level={0}
          pdf={pdf}
          onItemClick={onItemClick}
        />
      ))}
    </ul>
  );
};

export default PDFOutline;
