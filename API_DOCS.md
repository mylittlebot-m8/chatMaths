# ChatMaths API 接口文档

## 基础信息

- **API服务**: http://117.50.196.232:8002
- **Web服务**: http://117.50.196.232:8001

## 外部接口 (External API)

### 1. 提交错题
提交题目到AI辅导系统进行处理。

**接口**: `POST /external/submit`

**请求体**:
```json
{
  "uuid": "用户唯一标识",
  "typ": "error|test|example",
  "content": "题目描述",
  "imageUrl": "图片URL (可选)"
}
```

**响应**:
```json
{
  "success": true,
  "id": "题目ID",
  "message": "错题已收集，访问 http://117.50.196.232:8001/chat/{id} 查看最新讲解"
}
```

**示例**:
```bash
curl -X POST "http://117.50.196.232:8002/external/submit" \
  -H "Content-Type: application/json" \
  -d '{"uuid":"user123","typ":"error","content":"求解一元二次方程 x^2 + 5x + 6 = 0"}'
```

---

### 2. 搜索题目

支持两种搜索方式：**关键词搜索** 和 **向量搜索**

#### 关键词搜索
根据题目/内容中的关键词进行模糊匹配。

**接口**: `GET /external/search`

**参数**:
| 参数 | 必填 | 说明 |
|------|------|------|
| title | 是 | 搜索关键词 |
| uuid | 否 | 指定用户ID |
| typ | 否 | 题目类型 (error/test/example) |
| limit | 否 | 返回数量，默认10 |

**示例**:
```bash
curl "http://117.50.196.232:8002/external/search?title=测试&limit=5"
```

**响应**:
```json
{
  "success": true,
  "type": "keyword",
  "results": [
    {
      "id": "xxx",
      "title": "测试题目001",
      "user_id": "ou_xxx",
      "type": "error",
      "status": "completed",
      "created_at": "2026-03-13 09:16:20"
    }
  ]
}
```

#### 向量搜索 (语义搜索)
根据语义相似度进行搜索，需要数据库中有 text_embedding 向量数据。

**接口**: `GET /external/search`

**参数**:
| 参数 | 必填 | 说明 |
|------|------|------|
| key | 是 | 语义关键词 |
| uuid | 否 | 指定用户ID |
| typ | 否 | 题目类型 |
| limit | 否 | 返回数量，默认10 |

**示例**:
```bash
curl "http://117.50.196.232:8002/external/search?key=方程&limit=5"
```

**响应**:
```json
{
  "success": true,
  "type": "vector",
  "results": [
    {
      "id": "xxx",
      "title": "求解一元二次方程",
      "user_id": "xxx",
      "type": "error",
      "status": "completed",
      "similarity": 0.85
    }
  ]
}
```

---

### 3. 健康检查

**接口**: `GET /external/health`

**响应**:
```json
{
  "status": "ok",
  "timestamp": "2026-03-13T12:00:00.000Z"
}
```

---

## 聊天接口 (Chat API)

### 1. 获取聊天列表

**接口**: `GET /chat`

**参数**:
| 参数 | 必填 | 说明 |
|------|------|------|
| limit | 否 | 返回数量，默认10 |
| offset | 否 | 偏移量，默认0 |
| userId | 否 | 用户ID |
| typ | 否 | 题目类型 |

**示例**:
```bash
curl "http://117.50.196.232:8002/chat?limit=5&userId=ou_xxx"
```

---

### 2. 创建聊天

**接口**: `POST /chat`

**请求体**:
```json
{
  "input": "题目内容",
  "userId": "用户ID (可选)",
  "type": "题目类型 (可选，默认days)"
}
```

**响应**:
```json
{
  "id": "聊天ID"
}
```

---

### 3. 获取聊天详情

**接口**: `GET /chat/:id`

**示例**:
```bash
curl "http://117.50.196.232:8002/chat/xxxxx-xxxxx-xxxxx"
```

---

## 数据库字段说明

### chat 表主要字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| title | text | 标题 |
| content | text | 题目内容 |
| type | text | 类型 (error/test/days) |
| status | text | 状态 (pending/processing/completed/failed) |
| messages | jsonb | 对话消息 |
| concept | text | 知识点 |
| text_embedding | vector | 题目文本向量 (1024维) |
| solve_embedding | vector | 解答向量 (1024维) |
| concept_embedding | vector | 知识点向量 (1024维) |
| user_id | text | 用户ID |
| created_at | timestamp | 创建时间 |

---

## 向量搜索说明

### 生成向量时机

1. **初始提交时**: 创建聊天记录时生成初始 text_embedding
2. **解题完成后**: AI 返回准确题目后，用 `<problem>` 标签内容重新生成向量

### 向量维度

- 使用 **text-embedding-v3** 模型
- 向量维度: **1024维**

### 向量搜索示例

```sql
-- 在PostgreSQL中直接进行向量相似度搜索
SELECT id, title, 1 - (text_embedding <=> '[向量]'::vector) as similarity
FROM chat
WHERE text_embedding IS NOT NULL
ORDER BY text_embedding <=> '[向量]'::vector
LIMIT 5;
```

---

## 环境变量 (服务端配置)

服务端通过 `.env` 文件配置以下环境变量:

```bash
# 数据库
DATABASE_URL=postgresql://user:password@host:5432/dbname

# AI 模型
MODEL_API_KEY=xxx
MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
VISION_MODEL=qwen3-vl-plus-2025-12-19
AGENT_MODEL=qwen3.5-397b-a17b

# 对象存储
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=cn-beijing
AWS_BUCKET=aiguodu
```

---

## 错误码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

---

*最后更新: 2026-03-13*