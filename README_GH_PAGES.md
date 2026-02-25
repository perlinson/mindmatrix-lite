# GitHub Pages 部署

此目录包含编译后的静态文件，通过GitHub Pages托管。

## 配置API服务器
修改 `config.js` 文件中的API服务器地址：
```javascript
const API_CONFIG = {
    production: 'https://YOUR-API-SERVER-HERE.com', // ← 修改这里
    // ...
};
```

## 文件说明
- `index.html`: 主页面
- `*.css`: 样式文件
- `*.js`: JavaScript文件
- `config.js`: API服务器配置
- 其他静态资源

## 注意事项
1. 所有文件都是静态的，无服务器端逻辑
2. API调用需要配置正确的后端服务器
3. 更新需要重新构建并推送
