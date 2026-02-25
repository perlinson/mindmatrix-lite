# Render Deployment Configuration

## Build Command
```bash
npm install
```

## Start Command
```bash
npm start
```

## Environment Variables
- `PORT`: 10000 (Render自动分配)
- `NODE_ENV`: production

## Health Check Path
```
/
```

## Auto-Deploy
- 从GitHub main分支自动部署

## 部署到Render的步骤

### 1. 访问Render.com
- 注册/登录账号
- 连接GitHub账户

### 2. 创建Web Service
- 选择GitHub仓库: `perlinson/mindmatrix-lite`
- 名称: `mindmatrix-lite`
- 环境: `Node`
- 构建命令: `npm install`
- 启动命令: `npm start`
- 计划: `Free` (免费套餐)

### 3. 部署
- 点击"Create Web Service"
- 等待部署完成
- 获得公网URL: `https://mindmatrix-lite.onrender.com`

### 4. 测试
```bash
# 测试API
curl https://mindmatrix-lite.onrender.com/api/games

# 注册Agent
curl -X POST https://mindmatrix-lite.onrender.com/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "TestAgent", "type": "ai"}'
```

## 注意事项
1. Render免费套餐有休眠策略（15分钟无流量后休眠）
2. 首次请求可能需要几秒钟唤醒
3. 每月有免费额度限制
4. 支持WebSocket（Socket.io）