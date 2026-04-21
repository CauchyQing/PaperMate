import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConversationStore } from '../../stores/conversation';
import { useWorkspaceStore } from '../../stores/workspace';
import ConversationList from './ConversationList';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import { MessageSquarePlus, Settings, ArrowLeft, Camera, ListChecks, Trash2, X } from 'lucide-react';
import AISettings from '../AISettings/AISettings';
import ScreenshotCapture from '../ScreenshotCapture/ScreenshotCapture';
import type { Message } from '../../../shared/types';

const ChatPanel: React.FC = () => {
  const { currentWorkspace } = useWorkspaceStore();
  const {
    conversations, activeConversationId, messages,
    isStreaming, streamingContent, error, prefillText, agentSteps,
    loadConversations, createConversation, setActiveConversation,
    sendMessage, stopStreaming, clearError, setPrefillText, deleteMessages,
  } = useConversationStore();

  const [showConvList, setShowConvList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [screenshotPrompt, setScreenshotPrompt] = useState<string>('');
  const [pendingAttachment, setPendingAttachment] = useState<{ path: string; name: string } | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const workspacePath = currentWorkspace?.path || '';

  const activeConv = conversations.find(c => c.id === activeConversationId);

  useEffect(() => {
    if (workspacePath) {
      loadConversations(workspacePath);
    }
  }, [workspacePath, loadConversations]);

  const handleNewConversation = async () => {
    if (!workspacePath) return;
    await createConversation(workspacePath, { topic: '新对话' });
    setShowConvList(false);
  };

  const handleSelectConversation = async (id: string) => {
    await setActiveConversation(workspacePath, id);
    setShowConvList(false);
  };

  const handleSend = async (content: string, imageData?: string) => {
    if (!workspacePath) return;
    // Auto-create conversation if none active
    if (!activeConversationId) {
      await createConversation(workspacePath, {
        topic: content.slice(0, 30) + (content.length > 30 ? '...' : '新对话'),
      });
    }
    const metadata: Message['metadata'] = {};
    if (imageData) metadata.imageData = imageData;
    if (pendingAttachment) {
      metadata.attachments = [{ type: 'pdf', path: pendingAttachment.path, name: pendingAttachment.name }];
    }
    await sendMessage(workspacePath, content, Object.keys(metadata).length > 0 ? metadata : undefined);
    setPendingImage(null);
    setPendingAttachment(null);
    setScreenshotPrompt(''); // Clear screenshot prompt after sending
    setPrefillText(null); // Clear prefill text after sending
  };

  const handleSelectAttachment = async () => {
    const result = await window.electronAPI.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown.pdf';
      setPendingAttachment({ path: filePath, name: fileName });
    }
  };

  const handleScreenshotCapture = (imageData: string, defaultPrompt?: string) => {
    setIsCapturing(false);
    setPendingImage(imageData);
    // If default prompt provided, set it as input text
    if (defaultPrompt) {
      // We'll pass this to ChatInput via a ref or state
      // For now, let's use a different approach - set it in a state that ChatInput can read
      setScreenshotPrompt(defaultPrompt);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (!workspacePath || selectedIds.size === 0) return;
    await deleteMessages(workspacePath, Array.from(selectedIds));
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, [workspacePath, selectedIds, deleteMessages]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {!showConvList && activeConversationId && (
            <button onClick={() => setShowConvList(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {showConvList ? 'AI 助手' : (selectionMode ? `已选择 ${selectedIds.size} 条` : (activeConv?.topic || 'AI 助手'))}
          </h2>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!selectionMode ? (
            <>
              {!showConvList && (
                <button onClick={() => setIsCapturing(true)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="截图">
                  <Camera className="w-4 h-4 text-gray-500" />
                </button>
              )}
              <button onClick={handleNewConversation}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="新对话">
                <MessageSquarePlus className="w-4 h-4 text-gray-500" />
              </button>
              <button onClick={() => setShowSettings(true)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="AI 设置">
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
              {!showConvList && (
                <button onClick={() => setSelectionMode(true)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="多选删除">
                  <ListChecks className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30"
                title="删除选中">
                <Trash2 className={`w-4 h-4 ${selectedIds.size > 0 ? 'text-red-500' : 'text-gray-300 dark:text-gray-600'}`} />
              </button>
              <button onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="取消">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </>
          )}
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {showConvList ? (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            workspacePath={workspacePath}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              agentSteps={agentSteps}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
            {error && (
              <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between">
                <span className="truncate">{error}</span>
                <button onClick={clearError} className="text-red-400 hover:text-red-600 ml-2 flex-shrink-0">✕</button>
              </div>
            )}
            <ChatInput
              key={screenshotPrompt + (prefillText || '')} // Force remount when prompt changes
              onSend={handleSend}
              isStreaming={isStreaming}
              onStop={stopStreaming}
              pendingImage={pendingImage}
              onClearImage={() => setPendingImage(null)}
              initialText={screenshotPrompt || prefillText || ''}
              pendingAttachment={pendingAttachment}
              onClearAttachment={() => setPendingAttachment(null)}
              onSelectAttachment={handleSelectAttachment}
            />
          </>
        )}
      </div>

      <AISettings isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <ScreenshotCapture
        isActive={isCapturing}
        onCapture={handleScreenshotCapture}
        onCancel={() => setIsCapturing(false)}
      />
    </div>
  );
};

export default ChatPanel;
