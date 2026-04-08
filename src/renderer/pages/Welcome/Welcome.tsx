import React, { useEffect } from 'react';
import { FolderOpen, Plus, Clock, BookOpen } from 'lucide-react';
import { useWorkspaceStore } from '../../stores/workspace';

const Welcome: React.FC = () => {
  const { recentWorkspaces, openWorkspace, createWorkspace, getRecentWorkspaces } = useWorkspaceStore();

  useEffect(() => {
    getRecentWorkspaces();
  }, [getRecentWorkspaces]);

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.openDirectory();
    if (path) {
      await openWorkspace(path);
    }
  };

  const handleCreateWorkspace = async () => {
    const path = await window.electronAPI.openDirectory();
    if (path) {
      const name = path.split('/').pop() || 'New Workspace';
      await createWorkspace(path, name);
    }
  };

  const handleOpenRecent = async (path: string) => {
    await openWorkspace(path);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-5xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <BookOpen className="w-16 h-16 text-primary-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            PaperMate
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interactive Paper Reader with AI Assistant
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Recent Workspaces */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                最近打开
              </h2>
            </div>

            {recentWorkspaces.length > 0 ? (
              <div className="space-y-3">
                {recentWorkspaces.slice(0, 5).map((workspace) => (
                  <button
                    key={workspace.path}
                    onClick={() => handleOpenRecent(workspace.path)}
                    className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all group"
                  >
                    <div className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600">
                      {workspace.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {workspace.path}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatTime(workspace.lastOpenedAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>暂无最近打开的工作区</p>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="space-y-6">
            {/* Open Folder */}
            <button
              onClick={handleOpenFolder}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-left hover:shadow-xl hover:scale-[1.02] transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                  <FolderOpen className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    打开文件夹
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    选择项目文件夹开始管理和阅读论文
                  </p>
                </div>
              </div>
            </button>

            {/* Create Workspace */}
            <button
              onClick={handleCreateWorkspace}
              className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-left hover:shadow-xl hover:scale-[1.02] transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                  <Plus className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    新建工作区
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    创建新的研究项目文件夹
                  </p>
                </div>
              </div>
            </button>

            {/* Quick Start Guide */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">
                快速开始
              </h3>
              <ol className="space-y-3 text-sm text-primary-800 dark:text-primary-200">
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-primary-200 dark:bg-primary-800 px-2 py-0.5 rounded">1</span>
                  <span>创建或选择一个项目文件夹</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-primary-200 dark:bg-primary-800 px-2 py-0.5 rounded">2</span>
                  <span>拖入 PDF 论文或使用"导入"功能</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono bg-primary-200 dark:bg-primary-800 px-2 py-0.5 rounded">3</span>
                  <span>开始阅读，划选文字向 AI 提问</span>
                </li>
              </ol>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500 dark:text-gray-400 text-sm">
          <p>PaperMate v0.1.0 • Made for researchers</p>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
