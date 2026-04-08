import React from 'react';
import { X, FileText } from 'lucide-react';
import { useFileStore } from '../../stores/file';

const TabBar: React.FC = () => {
  const { openFiles, activeFileId, setActiveFile, closeFile } = useFileStore();

  if (openFiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
      {openFiles.map((file) => (
        <div
          key={file.id}
          className={`
            flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] cursor-pointer
            border-r border-gray-200 dark:border-gray-700
            transition-colors
            ${activeFileId === file.id
              ? 'bg-white dark:bg-gray-900 text-primary-600 border-t-2 border-t-primary-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
          onClick={() => setActiveFile(file.id)}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-sm truncate">{file.name}</span>
          <button
            className="p-0.5 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
            onClick={(e) => {
              e.stopPropagation();
              closeFile(file.id);
            }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default TabBar;
