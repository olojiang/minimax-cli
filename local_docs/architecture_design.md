# MiniMax Web Tool (MMX) - 架构设计文档

## 项目概述
本项目已从最初仅支持搜索和图像理解，升级为了全面对标 MiniMax 官方 `mmx` CLI 的全功能 Web 可视化工作台。
使用了 Vue 3 结合 Vite 搭建，采用了带有左侧侧边栏导航、中区工作面板、右侧全局可视化日志大屏的三栏式极简架构。

## 系统架构图

下面的 Mermaid 图展示了应用的核心架构与模块划分：

```mermaid
graph TD
    %% 核心组件
    subgraph UI 层 [Web UI (Vue 3)]
        App[App.vue\n主容器: 负责导航与路由控制]
        
        subgraph 左侧导航
            Sidebar[侧边栏栏目切换]
        end
        
        subgraph 中间工作区 (按需挂载)
            SettingsPanel[SettingsPanel.vue\nToken配置与配额查询]
            SearchPanel[SearchPanel.vue\n联网搜索]
            VisionPanel[VisionPanel.vue\n图像理解]
            ChatPanel[ChatPanel.vue\n文本对话]
            ImageGenPanel[ImageGenPanel.vue\n图像生成]
            SpeechPanel[SpeechPanel.vue\n语音合成]
            VideoGenPanel[VideoGenPanel.vue\n视频生成]
            MusicGenPanel[MusicGenPanel.vue\n音乐生成]
        end
        
        subgraph 右侧全局面板
            LogViewer[LogViewer.vue\n实时生命周期日志渲染]
        end
    end

    %% 业务逻辑层
    subgraph 逻辑层 [业务逻辑与 API]
        Client[api/client.ts\n涵盖 mmx 全量 REST 接口调用]
        Logger[utils/logger.ts\nPub/Sub 单例日志总线]
    end

    %% 外部服务
    subgraph 外部服务 [MiniMax Services]
        MinimaxAPI[api.minimaxi.com\nv1/coding_plan & 生成模型 API]
    end

    %% UI 组合与数据流
    App --> Sidebar
    Sidebar -.->|状态切换| SettingsPanel
    Sidebar -.->|状态切换| SearchPanel
    Sidebar -.->|状态切换| ChatPanel
    Sidebar -.->|状态切换| ImageGenPanel
    Sidebar -.->|...| VideoGenPanel
    App --> LogViewer

    %% API 请求流
    SettingsPanel & SearchPanel & ChatPanel & ImageGenPanel & SpeechPanel & VideoGenPanel & MusicGenPanel -->|调用对应纯函数| Client
    Client -->|HTTPS POST/GET| MinimaxAPI
    MinimaxAPI -->|返回业务 JSON| Client
    Client -->|响应| SettingsPanel & SearchPanel & ChatPanel & ImageGenPanel & SpeechPanel & VideoGenPanel & MusicGenPanel

    %% 日志事件流
    Client -.->|info/error/success| Logger
    Logger -.->|触发更新| LogViewer
```

## 设计亮点

1. **统一面板设计与样式复用**
   所有的功能面板均抽象共用 `src/styles/panel.less` 中的 `.panel`, `.input-group`, `.btn` 样式，保证了界面体验的一致性。
2. **极简 API 门面**
   `src/api/client.ts` 屏蔽了网络层的复杂性（Axios 和请求头管理），对外暴露出如 `textChat`, `generateImage` 等极其语义化的异步方法。
3. **单页面无痛切换**
   没有引入沉重的 Vue Router，而是利用 Vue 的响应式变量 `currentTab` 在 `App.vue` 中实现了 `v-if` 条件渲染。这样既保证了单个功能挂载时的环境独立，又避免了路由配置的复杂度。
