# PaperMate - 交互式论文阅读助手

PaperMate 是一款基于 Electron 的桌面端学术论文阅读工具，集成 AI 助手功能，帮助研究人员高效阅读、理解和管理学术论文。

![版本](https://img.shields.io/badge/version-1.1.0-blue)
![许可证](https://img.shields.io/badge/license-CC%20BY--NC%204.0-orange)

## 功能特性

### 核心功能

- **工作区模式** - 采用项目/工作区模式管理论文，所有数据保存在本地文件夹，便于协作和版本控制
- **PDF 阅读器** - 支持缩放、多标签页阅读
- **AI 助手** - 支持 OpenAI 兼容接口，可连接任意大模型平台（OpenAI、DeepSeek、本地模型等）
- **文本划选** - 划选 PDF 文本，一键翻译、解释或提问
- **截图提问** - 框选 PDF 区域截图，AI 视觉理解并回答
- **多维度分类** - 支持年份、期刊、主题标签、关键词等多维度分类管理
- **历史会话** - 自动保存对话历史，支持搜索、重命名、删除
- **标记功能** - 高亮/下划线标记 PDF 内容，添加批注笔记，侧边栏快速导航（v1.1.0 新增）

### AI 功能

- **论文翻译** - 逐段翻译，保持学术术语准确性，维护术语表保证一致性
- **内容解释** - 解释复杂概念、数学公式、图表结果
- **智能分析** - 自动分析论文内容，建议分类标签
- **上下文管理** - 滑动窗口 + 术语表，优化长对话 token 使用

## 安装

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/CauchyQing/PaperMate.git
cd PaperMate

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建应用
npm run build

# 打包（macOS）
npm run package:mac

# 打包（Windows）
npm run package:win
```

### 下载预编译版本

前往 [Releases](https://github.com/CauchyQing/PaperMate/releases) 页面下载对应系统的安装包。

## 使用指南

### 首次使用

1. 启动应用后，选择"新建工作区"
2. 配置 AI 供应商（设置 → AI 设置）
   - 支持 OpenAI、DeepSeek、Ollama 本地模型等
   - 输入 API Key 和 Base URL
3. 选择 PDF 文件
4. 开始阅读，划选文字或截图向 AI 提问

### 工作区模式

PaperMate 采用类似 VS Code 的工作区模式：

- 选择一个本地文件夹作为工作区
- 所有论文、分类、对话历史保存在该文件夹的 `.papermate/` 目录
- 整个文件夹可共享、版本控制（Git）
- 支持同时打开多个工作区（多窗口）

### AI 配置

支持以下 AI 供应商：

| 供应商 | Base URL | 支持模型 |
|-------|----------|---------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o, gpt-4o-mini |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat, deepseek-reasoner |
| Ollama (本地) | `http://localhost:11434/v1` | 本地部署模型 |
| 自定义 | 自定义地址 | 任意兼容模型 |

## 项目结构

```
papermate/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # React 前端
│   └── shared/         # 共享类型定义
├── resources/          # 静态资源
└── release/            # 构建输出

# 工作区结构示例
my-research/
├── .papermate/         # PaperMate 数据
│   ├── database/       # SQLite 数据库
│   └── settings.json   # 工作区设置
└── papers/             # 论文文件
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 构建主进程
npm run build:main

# 构建渲染进程
npm run build:renderer

# 预览构建结果
npm run preview
```

## 技术栈

- **框架**: Electron 33+
- **前端**: React 18 + TypeScript + TailwindCSS
- **状态管理**: Zustand
- **PDF 渲染**: react-pdf (PDF.js)
- **构建工具**: Vite

## 许可证

本项目采用 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 许可证。

- ✅ 允许个人非商业用途使用、修改、分发
- ✅ 允许学术研究使用
- ❌ 禁止商业用途
- ❌ 禁止用于商业服务或产品

详见 [LICENSE](./LICENSE) 文件。

---

**PaperMate** - 让论文阅读更高效
