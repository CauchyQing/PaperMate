import React, { useState, useCallback } from 'react';
import { useWorkspaceStore } from '../../stores/workspace';
import FileBrowser from '../../components/FileBrowser/FileBrowser';
import CategoryView from '../../components/CategoryView/CategoryView';
import AdvancedFilter from '../../components/AdvancedFilter/AdvancedFilter';
import PDFViewer from '../../components/PDFViewer/PDFViewer';
import TabBar from '../../components/TabBar/TabBar';
import ResizableSplitter from '../../components/ResizableSplitter/ResizableSplitter';
import ChatPanel from '../../components/ChatPanel/ChatPanel';
import { Folder, Layers, Filter as FilterIcon, Bookmark, PanelLeft, MessageSquare } from 'lucide-react';
import AnnotationSidebar from '../../components/AnnotationSidebar/AnnotationSidebar';

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 400;
const MIN_CHAT_WIDTH = 200;
const MAX_CHAT_WIDTH = 600;

const Workspace: React.FC = () => {
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const closeWorkspace = useWorkspaceStore((s) => s.closeWorkspace);

  // View state: 'files' | 'categories' | 'filter' | 'annotations'
  const [sidebarView, setSidebarView] = useState<'files' | 'categories' | 'filter' | 'annotations'>('files');

  // Resizable widths
  const [fileBrowserWidth, setFileBrowserWidth] = useState(280);
  const [chatPanelWidth, setChatPanelWidth] = useState(360);

  // Panel open states
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(true);

  const handleFileBrowserResize = useCallback((delta: number) => {
    setFileBrowserWidth(prev => {
      const newWidth = prev + delta;
      if (newWidth < MIN_SIDEBAR_WIDTH / 2) {
        setTimeout(() => setIsLeftSidebarOpen(false), 0);
        return 280; // Reset width for when it is reopened
      }
      return Math.min(MAX_SIDEBAR_WIDTH, newWidth);
    });
  }, []);

  const handleChatPanelResize = useCallback((delta: number) => {
    setChatPanelWidth(prev => {
      const newWidth = prev + delta;
      if (newWidth < MIN_CHAT_WIDTH / 2) {
        setTimeout(() => setIsChatPanelOpen(false), 0);
        return 360; // Reset width for when it is reopened
      }
      return Math.min(MAX_CHAT_WIDTH, newWidth);
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      {/* Top Bar - macOS draggable region */}
      <div
        className="h-10 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: Space for macOS traffic lights (80px) + Workspace name and toggle buttons */}
        <div className="flex items-center gap-2 pl-20" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="font-semibold text-gray-900 dark:text-white text-sm mr-2">
            {currentWorkspace?.name || 'Workspace'}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className={`p-1 rounded transition-colors flex items-center justify-center ${
                isLeftSidebarOpen 
                  ? 'text-gray-900 bg-gray-200 dark:text-white dark:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={isLeftSidebarOpen ? "隐藏侧边栏" : "显示侧边栏"}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsChatPanelOpen(!isChatPanelOpen)}
              className={`p-1 rounded transition-colors flex items-center justify-center ${
                isChatPanelOpen 
                  ? 'text-gray-900 bg-gray-200 dark:text-white dark:bg-gray-700' 
                  : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={isChatPanelOpen ? "隐藏AI对话" : "显示AI对话"}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Close button */}
        <button
          onClick={closeWorkspace}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          关闭工作区
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - File Browser or Category View */}
        <div
          className={`flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col ${isLeftSidebarOpen ? '' : 'hidden'}`}
          style={{ width: Math.max(MIN_SIDEBAR_WIDTH, fileBrowserWidth) }}
        >
          {/* Sidebar View Switcher */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setSidebarView('files')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                sidebarView === 'files'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Folder className="w-4 h-4" />
              文件
            </button>
            <button
              onClick={() => setSidebarView('categories')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                sidebarView === 'categories'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              分类
            </button>
            <button
              onClick={() => setSidebarView('filter')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                sidebarView === 'filter'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FilterIcon className="w-4 h-4" />
              筛选
            </button>
            <button
              onClick={() => setSidebarView('annotations')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${
                sidebarView === 'annotations'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              标记
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            {sidebarView === 'files' && <FileBrowser />}
            {sidebarView === 'categories' && <CategoryView />}
            {sidebarView === 'filter' && <AdvancedFilter />}
            {sidebarView === 'annotations' && <AnnotationSidebar />}
          </div>
        </div>

        {/* Resizable Splitter 1 */}
        <ResizableSplitter
          direction="horizontal"
          onResize={handleFileBrowserResize}
          className={isLeftSidebarOpen ? '' : 'hidden'}
        />

        {/* Center - Chat Panel */}
        <div
          className={`flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden ${isChatPanelOpen ? '' : 'hidden'}`}
          style={{ width: Math.max(MIN_CHAT_WIDTH, chatPanelWidth) }}
        >
          <ChatPanel />
        </div>

        {/* Resizable Splitter 2 */}
        <ResizableSplitter
          direction="horizontal"
          onResize={handleChatPanelResize}
          className={isChatPanelOpen ? '' : 'hidden'}
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
