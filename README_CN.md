<div align="right">
  <span>[<a href="./README.md">English</a>]<span>
  </span>[<a href="./README_CN.md">简体中文</a>]</span>
</div>  

<div align="center">

  <img src="./assets/logo.png" alt="ChatTutor" width="150" height="150" />

  <h1>ChatTutor</h1>

  <p>可视化与交互式 AI 教师</p>
  
  <div align="center">
    <img src="https://img.shields.io/github/package-json/v/HugeCatLab/ChatTutor" alt="Version" />
    <img src="https://img.shields.io/github/license/HugeCatLab/ChatTutor" alt="License" />
    <img src="https://img.shields.io/github/stars/HugeCatLab/ChatTutor?style=social" alt="Stars" />
    <img src="https://img.shields.io/github/forks/HugeCatLab/ChatTutor?style=social" alt="Forks" />
    <img src="https://img.shields.io/github/last-commit/HugeCatLab/ChatTutor" alt="Last Commit" />
    <img src="https://img.shields.io/github/issues/HugeCatLab/ChatTutor" alt="Issues" />
  </div>
  
</div>

---

> [!NOTE]
>
> 在线网站：ChatTutor 已上线 [https://chattutor.app](https://chattutor.app)，请在设置中配置你的 API 密钥和模型。([https://chattutor.app/settings](https://chattutor.app/settings))

ChatTutor 是一个配备了电子白板功能的 AI 教师。

传统的聊天机器人主要通过文字与用户交互，这在大多数场景下已经足够。然而，随着近年来大语言模型（LLM）的发展，越来越多的人开始使用 AI 来辅助学习。在真实课堂中，教师拥有许多教学工具——粉笔、电脑、黑板等——这些都能帮助学生更好地理解知识。但对于聊天机器人来说，仅靠文字传递信息是非常有限的，尤其是在 STEM 学科中。

ChatTutor 有效地解决了这一问题。它将现实教育场景中的各种教学工具数字化呈现，让用户能够通过电子设备与之交互。我们赋予了 AI 使用这些教学工具的能力，使其真正成为一个"能动手"的教师。

## Features

##### 数学画板
<table>
  <tr>
    <td>
      <img src="./assets/demo-math-1.png" alt="Math Canvas" width="100%" />
    </td>
    <td>
      <img src="./assets/demo-math-2.png" alt="Math Canvas" width="100%" />
    </td>
  </tr>
  <tr>
    <td>
      <img src="./assets/demo-math-3.png" alt="Math Canvas" width="100%" />
    </td>
    <td>
      <img src="./assets/demo-math-4.png" alt="Math Canvas" width="100%" />
    </td>
  </tr>
</table>

##### 思维导图
<table>
  <tr>
    <td>
      <img src="./assets/demo-mermaid-1.png" alt="Mindmap" width="100%" />
    </td>
    <td>
      <img src="./assets/demo-mermaid-2.png" alt="Mindmap" width="100%" />
    </td>
  </tr>
</table>

## 快速开始

<details><summary>环境变量</summary>

### 数据库配置
- `DATABASE_URL`: PostgreSQL 连接字符串

### 服务器与客户端
- `VITE_API_BASE_URL`: API 服务器的基础 URL（例如：`http://localhost:8002`）
- `CLINET_BASE_URL`: 客户端应用程序的基础 URL（例如：`http://localhost:8001`）

### AI 配置
- `MODEL_API_KEY`: AI 服务的 API 密钥（例如：`your_api_key_here`）
- `MODEL_BASE_URL`: AI 服务的基础 URL（可选，默认为 OpenAI）
- `AGENT_MODEL`: 与用户聊天的主代理模型（例如：`gpt-4`）
- `AGENT_MODEL_PROVIDER`: 模型提供商（选项：参考 [提供商枚举](#provider-enum)）
- `TITLE_MODEL`: 用于生成聊天标题的模型（可选，默认为 `AGENT_MODEL`）
- `TITLE_MODEL_PROVIDER`: 标题生成的模型提供商（可选，默认为 `AGENT_MODEL_PROVIDER`，参考 [提供商枚举](#provider-enum)）

#### 提供商枚举
- OpenAI: `openai`
- Anthropic: `anthropic`
- DeepSeek: `deepseek`

### OSS 配置
- `OSS_ENDPOINT`: OSS 端点 URL（如果未设置，图片上传将不可用）
- `OSS_ACCESS_KEY`: OSS 访问密钥
- `OSS_SECRET_KEY`: OSS 密钥
- `OSS_BUCKET`: OSS 存储桶名称
- `OSS_REGION`: OSS 区域

</details>

<details><summary>使用 Docker 运行</summary>

### 环境要求

> - Docker >= 24.0.0
> - Docker Compose >= 2.22.0

### 安装步骤

```bash
git clone https://github.com/HugeCatLab/ChatTutor.git
cd ChatTutor
cp .env.example .env
```

### 运行

```bash
cd docker
docker compose up -d
```
</details>

<details><summary>使用 Node & Bun 运行</summary>

### 环境要求

> - Node.js >= 20
> - Bun >= 1.2
> - pnpm >= 9.1.0

### 安装步骤

```bash
git clone https://github.com/HugeCatLab/ChatTutor.git
cd ChatTutor
pnpm i
```

### 开发模式

```bash
pnpm dev
```

或者：

```bash
pnpm client:dev
pnpm web:dev
```

### 构建

```bash
pnpm build
pnpm client:start
pnpm web:start
```

</details>


## Tech Stacks

- [Geogebra](https://www.geogebra.org/)
- [Vue](https://vuejs.org/)
- [Vite](https://vitejs.dev)
- [ElysiaJs](https://https://elysiajs.com/)
- [AI SDK](https://ai-sdk.dev/)

## Sponsors
我们的赞助商列表如下（排名不分先后）：

- [AiHubMix](https://aihubmix.com/): 开放模型 API 平台。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=HugeCatLab/ChatTutor&type=date&legend=top-left)](https://www.star-history.com/#HugeCatLab/ChatTutor&type=date&legend=top-left)

---
**AGPL v3 License**

*版权 (c) 2025 Acbox, 保留所有权利。*
