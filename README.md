# PaperMate - 交互式论文阅读助手

PaperMate 是一款基于 Electron 的桌面端学术论文阅读工具，集成 AI 助手功能，帮助研究人员高效阅读、理解和管理学术论文。

![版本](https://img.shields.io/badge/version-2.6.0-blue)
![许可证](https://img.shields.io/badge/license-CC%20BY--NC%204.0-orange)

## 2.6.0 更新：AI 沉浸式翻译与持久化

v2.6.0 引入了全新的**沉浸式翻译面板**和**划词翻译气泡**，并实现了翻译内容的本地持久化存储。

### 新增功能

- **AI 沉浸式翻译面板** - 点击阅读器工具栏的翻译图标，开启分屏对照模式。AI 会自动按页提取文本并进行语义化翻译，支持双语对照阅读。
- **滚动自动同步** - 翻译面板会实时感知 PDF 的阅读进度，自动滚动到对应页码，确保翻译内容始终与原文对齐。
- **翻译内容持久化** - 所有的页面翻译结果都会自动保存到本地工作区数据库中。再次打开同一份论文时，翻译内容秒级加载，无需重复消耗 AI Token。
- **划词翻译气泡** - 选词后点击“翻译”，对于短语和单词将直接在光标处弹出轻量级翻译气泡，提供精准的词典释义，不干扰主对话面板。
- **智能分段与格式优化** - 优化了提取逻辑和提示词策略，翻译结果现在拥有更清晰的段落划分和标题加粗，阅读体验更接近实体书籍。

## 2.5.0 更新：PDF 阅读体验优化

v2.5.0 重点优化了 PDF 阅读器的交互体验，并引入了**每个 PDF 独立记忆缩放**的功能。

### 新增与优化

- **独立缩放记忆** - 每个 PDF 文件现在会单独保存自己的缩放比例，切换标签页后自动恢复，不再全局共用同一个缩放
- **修复 Windows 划选闪烁** - 修复了 Windows 下 PDF 文本划选时蓝色选区闪烁、乱跳、框选错位的问题，划选体验现在与 macOS 保持一致

## 2.0.0 重磅更新：ReAct Agent + Skill 系统

v2.0.0 引入了**完整的 ReAct Agent 架构**和**兼容 Claude Code 的 Skill 系统**。AI 不再只是单轮问答，而是能够自主思考、调用工具、完成任务。

### 核心新功能

- **ReAct Agent 循环** - AI 会分析你的需求，自动决定调用哪些工具，完成多步任务
- **PDF 智能提取** - 上传 PDF 后，AI 自动提取文本并生成结构化摘要，后续对话无需重复提取
- **浏览器搜索** - 内置浏览器自动化能力，可直接在 Google Scholar、Bilibili 等网站搜索并提取结果
- **Skill 系统** - 兼容 Claude Code `skill-name/SKILL.md` 格式，放入目录即可扩展新能力
- **Agent 过程可视化** - 聊天界面实时显示 AI 的“思考 → 调用工具 → 观察结果 → 最终回答”完整链路
- **多轮上下文缓存** - 同一对话内，PDF 内容会被缓存，后续提问秒回，不需要重新上传

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
3. 选择 PDF 文件开始阅读，或直接打开 AI 助手聊天窗口

### Agent + Skill 功能（开箱即用）

PaperMate 2.0 内置了多个常用 Skill，**无需额外配置即可使用**：

| 功能 | 说明 | 使用方式 |
|------|------|----------|
| **PDF 解析** | 自动提取 PDF 文本并生成结构化摘要 | 在聊天框点击 📎 上传 PDF，直接提问 |
| **浏览器搜索** | 在 Google Scholar、Bilibili 等网站搜索 | 直接说"帮我搜索 xxx" |
| **Bash 执行** | 执行系统命令和脚本 | Skill 内部自动使用 |

#### 示例 1：上传 PDF 并总结

1. 新建一个 AI 对话
2. 点击输入框左侧的 📎 按钮，选择一份本地 PDF
3. 输入："帮我总结一下这篇论文"
4. AI 会自动：
   - 提取 PDF 文本
   - 生成结构化摘要（标题、背景、方法、实验、结论、关键词）
   - 返回总结

**后续对话**：你可以直接继续问"方法部分怎么设计的？"、"实验结果如何？"，AI 会基于已缓存的 PDF 内容秒回，**不需要再次上传**。

#### 示例 2：搜索相关论文

1. 上传 PDF 后，输入："帮我提取关键词并在 Google Scholar 搜索相关论文"
2. AI 会自动：
   - 从 PDF 中提取关键词
   - 打开 Google Scholar 搜索
   - 返回相关论文列表

#### 示例 3：任意网页搜索

直接输入：
- "打开 arxiv 查找关于 reinforcement learning 的最新论文"
- "在 Google Scholar 搜索 GAN 在医学图像中的应用"

AI 会自动调用浏览器工具完成搜索并提取结果。

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
| OpenAI | `https://api.openai.com/v1` | gpt系列模型 |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat, deepseek-reasoner |
| Ollama (本地) | `http://localhost:11434/v1` | 本地部署模型 |
| 自定义 | 自定义地址 | 任意兼容模型 |

## 扩展 Skill（高级）（未完全测试）

PaperMate 的 Skill 系统完全兼容 Claude Code 的 `skill-name/SKILL.md` 格式。

### 添加自定义 Skill

1. 在 `~/.papermate/skills/` 下创建新目录，例如 `my-skill/`
2. 编写 `SKILL.md`：

```markdown
---
name: my-skill
description: 我的自定义工具
allowed-tools: [bash, cdp_new]
---

> 内置的 `web-access` 和 `pdf` skills 已经预装在 `~/.papermate/skills/` 目录下，可以直接修改或参考。

## 项目结构

```
papermate/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── agent/      # ReAct Agent 循环 + Tool Registry
│   │   ├── skills/     # Skill 加载器和运行时
│   │   └── services/   # AI 服务、PDF 上下文、对话存储
│   ├── renderer/       # React 前端
│   └── shared/         # 共享类型定义
├── resources/          # 静态资源
└── release/            # 构建输出

# 工作区结构示例
my-research/
├── .papermate/         # PaperMate 数据
│   ├── database/       # JSON 数据库
│   ├── settings.json   # 工作区设置
│   └── skills/         # 工作区专属 skills
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
- **浏览器自动化**: Playwright + Chrome DevTools Protocol
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
