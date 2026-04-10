import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Loader2, Zap, Settings } from 'lucide-react';
import { PRESET_PROVIDERS } from '../../../shared/types/ai';
import type { AIProviderConfig, PresetProvider } from '../../../shared/types/ai';

interface AISettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

function generateId(): string {
  return `provider_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const AISettings: React.FC<AISettingsProps> = ({ isOpen, onClose }) => {
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) loadProviders();
  }, [isOpen]);

  const loadProviders = async () => {
    const list = await window.electronAPI.aiGetProviders();
    setProviders(list);
    const active = await window.electronAPI.aiGetActiveProvider();
    setActiveId(active?.id);
  };

  if (!isOpen) return null;

  const handlePresetSelect = (preset: PresetProvider) => {
    setEditingProvider({
      id: generateId(),
      name: preset.name,
      baseUrl: preset.baseUrl,
      apiKey: '',
      models: preset.models,
      defaultModel: preset.defaultModel,
      supportsVision: preset.supportsVision,
    });
    setTestStatus('idle');
  };

  const handleNewCustom = () => {
    setEditingProvider({
      id: generateId(),
      name: '',
      baseUrl: '',
      apiKey: '',
      models: [],
      defaultModel: '',
    });
    setTestStatus('idle');
  };

  const handleEditExisting = (provider: AIProviderConfig) => {
    setEditingProvider({ ...provider });
    setTestStatus('idle');
  };

  const handleTest = async () => {
    if (!editingProvider) return;
    setTestStatus('testing');
    setTestError('');
    const result = await window.electronAPI.aiTestConnection(editingProvider);
    if (result.success) {
      setTestStatus('success');
    } else {
      setTestStatus('error');
      setTestError(result.error || '连接失败');
    }
  };

  const handleSave = async () => {
    if (!editingProvider || !editingProvider.name || !editingProvider.baseUrl) return;
    setSaving(true);
    try {
      await window.electronAPI.aiSaveProvider(editingProvider);
      await loadProviders();
      setEditingProvider(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (providerId: string) => {
    if (!confirm('确定要删除这个 AI 供应商配置吗？')) return;
    await window.electronAPI.aiDeleteProvider(providerId);
    await loadProviders();
    if (editingProvider?.id === providerId) setEditingProvider(null);
  };

  const handleSetActive = async (providerId: string) => {
    await window.electronAPI.aiSetActive(providerId);
    setActiveId(providerId);
  };

  const handleModelsChange = (value: string) => {
    if (!editingProvider) return;
    const models = value.split(',').map(s => s.trim()).filter(Boolean);
    setEditingProvider({ ...editingProvider, models, defaultModel: models[0] || '' });
  };
  // RENDER
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5" />
            AI 供应商设置
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          {/* Existing Providers */}
          {providers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">已配置的供应商</h3>
              <div className="space-y-2">
                {providers.map(p => (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    activeId === p.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleSetActive(p.id)} className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        activeId === p.id ? 'border-primary-500 bg-primary-500' : 'border-gray-400'
                      }`}>
                        {activeId === p.id && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.defaultModel} - {p.baseUrl}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditExisting(p)} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                        <Settings className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Add New Provider */}
          {!editingProvider && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">添加供应商</h3>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_PROVIDERS.map(preset => (
                  <button key={preset.name} onClick={() => handlePresetSelect(preset)}
                    className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left">
                    <Zap className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.baseUrl || '自定义地址'}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Editing Form */}
          {editingProvider && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {providers.find(p => p.id === editingProvider.id) ? '编辑供应商' : '新建供应商'}
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">名称</label>
                  <input type="text" value={editingProvider.name}
                    onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })}
                    placeholder="例如: OpenAI"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Base URL</label>
                  <input type="text" value={editingProvider.baseUrl}
                    onChange={e => setEditingProvider({ ...editingProvider, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">API Key</label>
                <input type="password" value={editingProvider.apiKey}
                  onChange={e => setEditingProvider({ ...editingProvider, apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">模型列表（逗号分隔）</label>
                  <input type="text" value={editingProvider.models.join(', ')}
                    onChange={e => handleModelsChange(e.target.value)}
                    placeholder="gpt-4o, gpt-4o-mini"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">默认模型</label>
                  {editingProvider.models.length > 0 ? (
                    <select value={editingProvider.defaultModel}
                      onChange={e => setEditingProvider({ ...editingProvider, defaultModel: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                      {editingProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={editingProvider.defaultModel}
                      onChange={e => setEditingProvider({ ...editingProvider, defaultModel: e.target.value })}
                      placeholder="模型名称"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="supportsVision" checked={editingProvider.supportsVision || false}
                  onChange={e => setEditingProvider({ ...editingProvider, supportsVision: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="supportsVision" className="text-sm text-gray-700 dark:text-gray-300">支持图片识别 (Vision)</label>
              </div>

              {/* Test & Actions */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button onClick={handleTest} disabled={testStatus === 'testing' || !editingProvider.baseUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors">
                    {testStatus === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    测试连接
                  </button>
                  {testStatus === 'success' && <span className="text-sm text-green-600">连接成功</span>}
                  {testStatus === 'error' && <span className="text-sm text-red-500" title={testError}>连接失败</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingProvider(null)}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                    取消
                  </button>
                  <button onClick={handleSave} disabled={saving || !editingProvider.name || !editingProvider.baseUrl}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg transition-colors">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AISettings;
