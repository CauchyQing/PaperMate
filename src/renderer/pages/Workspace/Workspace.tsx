import React from 'react';
import { useWorkspaceStore } from '../../stores/workspace';

const Workspace: React.FC = () => {
  const { currentWorkspace, closeWorkspace } = useWorkspaceStore();

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Top Bar */}
      <div className="h-12 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {currentWorkspace?.name || 'Workspace'}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={closeWorkspace}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          关闭工作区
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser Placeholder */}
        <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            文件浏览器
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            （功能开发中）
          </p>
        </div>

        {/* Center - Chat Panel Placeholder */}
        <div className="w-96 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              AI 助手
            </h2>
          </div>
          <div className="flex-1 p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              （对话功能开发中）
            </p>
          </div>
        </div>

        {/* Right - PDF Viewer Placeholder */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-800 flex flex-col">
          <div className="h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center px-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              PDF 阅读器（开发中）
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                工作区已打开
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {currentWorkspace?.path}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Workspace;
