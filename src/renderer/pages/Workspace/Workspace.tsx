import React, { useState, useCallback } from 'react';
import { useWorkspaceStore } from '../../stores/workspace';
import FileBrowser from '../../components/FileBrowser/FileBrowser';
import PDFViewer from '../../components/PDFViewer/PDFViewer';
import TabBar from '../../components/TabBar/TabBar';
import ResizableSplitter from '../../components/ResizableSplitter/ResizableSplitter';

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;
const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 500;

const Workspace: React.FC = () => {
  const { currentWorkspace, closeWorkspace } = useWorkspaceStore();

  // Resizable widths
  const [fileBrowserWidth, setFileBrowserWidth] = useState(240);
  const [chatPanelWidth, setChatPanelWidth] = useState(360);

  const handleFileBrowserResize = useCallback((delta: number) => {
    setFileBrowserWidth(prev => {
      const newWidth = prev + delta;
      return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, newWidth));
    });
  }, []);

  const handleChatPanelResize = useCallback((delta: number) => {
    setChatPanelWidth(prev => {
      const newWidth = prev + delta;
      return Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, newWidth));
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Top Bar - macOS draggable region */}
      <div
        className="h-10 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4"
        style={{ WebkitAppRegion: 'drag' as any }}
      >
        {/* Left: Space for macOS traffic lights (80px) + Workspace name */}
        <div className="flex items-center gap-2 pl-20" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            {currentWorkspace?.name || 'Workspace'}
          </span>
        </div>

        {/* Right: Close button */}
        <button
          onClick={closeWorkspace}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' as any }}
        >
          关闭工作区
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser */}
        <div
          className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden"
          style={{ width: fileBrowserWidth }}
        >
          <FileBrowser />
        </div>

        {/* Resizable Splitter 1 */}
        <ResizableSplitter
          direction="horizontal"
          onResize={handleFileBrowserResize}
        />

        {/* Center - Chat Panel (Placeholder) */}
        <div
          className="flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
          style={{ width: chatPanelWidth }}
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              AI 助手
            </h2>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-auto">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              （对话功能即将推出）
            </p>
          </div>
        </div>

        {/* Resizable Splitter 2 */}
        <ResizableSplitter
          direction="horizontal"
          onResize={handleChatPanelResize}
        />

        {/* Right - PDF Viewer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TabBar />
          <PDFViewer />
        </div>
      </div>
    </div>
  );
};

export default Workspace;
