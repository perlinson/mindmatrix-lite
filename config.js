// API服务器配置 - GitHub Pages版本
// 请根据你的部署情况修改这个配置

const API_CONFIG = {
    // 生产环境API服务器
    // 请将下面的URL替换为你的实际后端服务器地址
    // 例如: https://mindmatrix-lite.onrender.com
    production: 'https://YOUR-API-SERVER-HERE.com',
    
    // 自动检测环境
    getServerUrl: function() {
        // 如果是GitHub Pages，使用生产环境服务器
        if (window.location.hostname.includes('github.io')) {
            return this.production;
        }
        
        // 本地开发 (如果从file://协议打开)
        if (window.location.hostname === '' || window.location.protocol === 'file:') {
            return 'http://localhost:3000';
        }
        
        // 默认使用当前域名
        return window.location.origin;
    }
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
