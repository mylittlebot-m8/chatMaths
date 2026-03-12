# Skill: 题目讲解缓存优化工具

## 目标
优化初中数学题目的 AI 讲解缓存，使其适合备课。

## 适用场景
- 现有讲解存在 bug（GeoGebra 错误、步骤跳跃、答案错误）
- 需要迭代优化直到适合学生理解
- 面向初中7-9年级学生，不能超纲

## 前置条件
1. 服务器可 SSH 访问：`ssh ubuntu@117.50.196.232`
2. 项目路径：`/home/ubuntu/tutor`
3. 数据库可查询（PostgreSQL）
4. 本地有项目副本：`~/tutor`

---

## 工作流程

### Step 1: 获取题目聊天记录

```bash
# SSH 到服务器，从数据库提取完整聊天记录
ssh ubuntu@117.50.196.232 \
  "PGPASSWORD=${DB_PASSWORD} psql -U chattutor -h localhost -d chattutor \
   -t -c \"SELECT messages, pages FROM chat WHERE id::text = 'CHAT_ID';\"" \
  > /tmp/chat_output.txt
```

### Step 2: 分析问题

检查以下常见问题：

#### 2.1 GeoGebra 问题
- GGB 命令是否被 Concatenated（缺少换行）
- 坐标计算是否正确
- 图形元素是否完整

#### 2.2 讲解详尽度
- 是否跳步过多
- 是否有超纲内容（高中及以上）
- 答案是否正确

#### 2.3 页面结构
- 是否需要拆分为更多子页面
- 标题是否清晰

### Step 3: 创建/更新缓存版本

在数据库中创建优化后的版本：

```sql
-- 创建题目缓存表（建议）
CREATE TABLE IF NOT EXISTS question_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_chat_id UUID REFERENCES chat(id),
  version INT NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  content JSONB NOT NULL,  -- 优化后的完整讲解内容
  issues JSONB,            -- 记录发现的问题
  status TEXT DEFAULT 'draft',  -- draft, reviewing, approved
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### Step 4: 迭代优化

1. **直接修改数据库** 中的 messages 和 pages
2. **重新生成** 讲解（可使用新 prompt）

---

## 常用命令

### 查看当前讲解内容
```bash
ssh ubuntu@117.50.196.232 \
  "PGPASSWORD=${DB_PASSWORD} psql -U chattutor -h localhost -d chattutor \
   -c \"SELECT jsonb_pretty((messages)::jsonb) FROM chat WHERE id::text = 'CHAT_ID';\""
```

### 查看页面内容
```bash
ssh ubuntu@117.50.196.232 \
  "PGPASSWORD=${DB_PASSWORD} psql -U chattutor -h localhost -d chattutor \
   -c \"SELECT jsonb_pretty((pages)::jsonb) FROM chat WHERE id::text = 'CHAT_ID';\""
```

### 更新 messages
```bash
ssh ubuntu@117.50.196.232 \
  "PGPASSWORD=${DB_PASSWORD} psql -U chattutor -h localhost -d chattutor \
   -c \"UPDATE chat SET messages = '[...]'::jsonb WHERE id::text = 'CHAT_ID';\""
```

---

## 当前题目问题（案例）

题目：直角三角形动点问题（03864e08-d051-4736-88b5-01756200b670）

### 已识别问题：

1. **GeoGebra 错误**
   - GGB 命令被 concat，没有换行分隔
   - E 点坐标错误：`E = (0.5, -0.5)` 应根据旋转计算

2. **答案错误**
   - 第2问：BE = 5/2（错误），正确答案是 5√2/2
   - 推导过程中有计算错误

3. **步骤跳跃**
   - 第3问①证明过程中有错误推导
   - 缺少必要的中间步骤

---

## 优化建议

### 1. 修正 GeoGebra
```ggb
# 每个命令换行分隔
A = (4, 0)
B = (0, 3)
C = (0, 0)
D = (2, 1.5)
E = (3.5, -0.5)  # 修正：正确的旋转坐标
```

### 2. 简化讲解（适合初中）
- 减少 LaTeX 公式复杂度
- 增加文字说明
- 使用学生能理解的语言

### 3. 拆分页面
- geom-base: 基本图形
- geom-rotate: 旋转法证明
- geom-midpoint: 中点计算
- geom-relation: 关系证明
- geom-min: 最小值

---

## 文件位置

- 本地项目：`~/tutor`
- 服务器项目：`/home/ubuntu/tutor`
- 数据库：PostgreSQL chattutor@localhost:5432
