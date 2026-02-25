// MindMatrix Lite 前端游戏逻辑
let socket = null;
let currentGame = null;
let defaultGameId = null;
let timerInterval = null;
let timeLeft = 20;

// DOM元素
const connectBtn = document.getElementById('connect-btn');
const newGameBtn = document.getElementById('new-game-btn');
const spectateBtn = document.getElementById('spectate-btn');
const clearLogBtn = document.getElementById('clear-log-btn');
const gameIdEl = document.getElementById('game-id');
const gameStatusEl = document.getElementById('game-status');
const turnNumberEl = document.getElementById('turn-number');
const timerEl = document.getElementById('timer');
const logContent = document.getElementById('log-content');
const defaultGameIdEl = document.getElementById('default-game-id');

// 单位表情映射
const unitEmojis = {
    'scout': '👁️',
    'warrior': '⚔️',
    'mage': '🔮'
};

// 资源表情映射
const resourceEmojis = {
    'energy': '⚡',
    'mind': '🧠',
    'gem': '💎'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initBoard();
    setupEventListeners();
    autoConnect();
});

// 初始化棋盘
function initBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    // 创建5×5棋盘
    for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell_${x}_${y}`;
            cell.dataset.x = x;
            cell.dataset.y = y;
            board.appendChild(cell);
        }
    }
}

// 设置事件监听器
function setupEventListeners() {
    connectBtn.addEventListener('click', connectToServer);
    newGameBtn.addEventListener('click', createNewGame);
    spectateBtn.addEventListener('click', spectateDefaultGame);
    clearLogBtn.addEventListener('click', clearLog);
}

// 自动连接服务器
function autoConnect() {
    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : window.location.origin;
    
    addLog('正在连接服务器...', 'system');
    
    // 尝试获取默认游戏ID
    fetch(`${serverUrl}/api/games`)
        .then(response => response.json())
        .then(games => {
            if (games && games.length > 0) {
                defaultGameId = games[0].id;
                defaultGameIdEl.textContent = defaultGameId;
                addLog(`发现默认游戏: ${defaultGameId}`, 'system');
            }
        })
        .catch(error => {
            addLog('无法获取游戏列表，请确保服务器正在运行', 'system');
        });
}

// 连接服务器
function connectToServer() {
    if (socket && socket.connected) {
        addLog('已经连接到服务器', 'system');
        return;
    }
    
    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : window.location.origin;
    
    socket = io(serverUrl);
    
    socket.on('connect', () => {
        addLog('成功连接到服务器', 'system');
        connectBtn.innerHTML = '<i class="fas fa-check"></i> 已连接';
        connectBtn.classList.add('btn-success');
        connectBtn.classList.remove('btn-primary');
        
        // 获取游戏列表
        fetchGames();
    });
    
    socket.on('disconnect', () => {
        addLog('与服务器断开连接', 'system');
        connectBtn.innerHTML = '<i class="fas fa-plug"></i> 连接服务器';
        connectBtn.classList.remove('btn-success');
        connectBtn.classList.add('btn-primary');
    });
    
    socket.on('error', (data) => {
        addLog(`错误: ${data.message}`, 'system');
    });
    
    socket.on('game_state', (state) => {
        currentGame = state;
        updateGameDisplay(state);
        addLog('收到游戏状态更新', 'system');
    });
    
    socket.on('game_update', (state) => {
        currentGame = state;
        updateGameDisplay(state);
        addLog('游戏状态已更新', 'system');
        
        // 高亮显示变化的单元格
        highlightChanges(state);
    });
    
    socket.on('player_joined', (data) => {
        const colorText = data.color === 'red' ? '红方' : '蓝方';
        addLog(`${colorText} Agent加入: ${data.agentId}`, data.color);
        
        // 更新玩家显示
        if (data.color === 'red') {
            document.getElementById('red-agent').textContent = `🔴 ${data.agentId}`;
        } else {
            document.getElementById('blue-agent').textContent = `🔵 ${data.agentId}`;
        }
    });
    
    socket.on('game_over', (data) => {
        const winnerText = data.winner === 'red' ? '红方' : '蓝方';
        addLog(`游戏结束！${winnerText}获胜！`, 'system');
        gameStatusEl.textContent = '游戏结束';
        gameStatusEl.style.color = '#4ecdc4';
        
        // 停止计时器
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    });
}

// 获取游戏列表
function fetchGames() {
    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : window.location.origin;
    
    fetch(`${serverUrl}/api/games`)
        .then(response => response.json())
        .then(games => {
            if (games && games.length > 0) {
                defaultGameId = games[0].id;
                defaultGameIdEl.textContent = defaultGameId;
                addLog(`发现 ${games.length} 个游戏`, 'system');
            } else {
                addLog('没有找到游戏，请创建一个新游戏', 'system');
            }
        })
        .catch(error => {
            addLog('获取游戏列表失败', 'system');
        });
}

// 创建新游戏
function createNewGame() {
    if (!socket || !socket.connected) {
        addLog('请先连接服务器', 'system');
        return;
    }
    
    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : window.location.origin;
    
    fetch(`${serverUrl}/api/games/new`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        defaultGameId = data.gameId;
        defaultGameIdEl.textContent = defaultGameId;
        gameIdEl.textContent = data.gameId;
        addLog(`创建新游戏: ${data.gameId}`, 'system');
        
        // 自动观战新游戏
        spectateGame(data.gameId);
    })
    .catch(error => {
        addLog('创建游戏失败', 'system');
    });
}

// 观战默认游戏
function spectateDefaultGame() {
    if (!defaultGameId) {
        addLog('没有默认游戏，请先创建游戏', 'system');
        return;
    }
    
    spectateGame(defaultGameId);
}

// 观战指定游戏
function spectateGame(gameId) {
    if (!socket || !socket.connected) {
        addLog('请先连接服务器', 'system');
        return;
    }
    
    socket.emit('spectate_game', gameId);
    gameIdEl.textContent = gameId;
    gameStatusEl.textContent = '观战中...';
    gameStatusEl.style.color = '#4ecdc4';
    addLog(`开始观战游戏: ${gameId}`, 'system');
}

// 更新游戏显示
function updateGameDisplay(state) {
    if (!state) return;
    
    // 更新回合信息
    turnNumberEl.textContent = state.turn;
    gameStatusEl.textContent = state.gameOver ? '游戏结束' : '进行中';
    
    // 更新资源显示
    updateResourceDisplay('red', state.resources.red);
    updateResourceDisplay('blue', state.resources.blue);
    
    // 更新单位计数
    document.getElementById('red-units').textContent = state.units.red.length;
    document.getElementById('blue-units').textContent = state.units.blue.length;
    
    // 更新棋盘
    updateBoard(state);
    
    // 启动/重置计时器
    if (!state.gameOver) {
        startTimer();
    }
}

// 更新资源显示
function updateResourceDisplay(color, resources) {
    const energyEl = document.getElementById(`${color}-energy`);
    const mindEl = document.getElementById(`${color}-mind`);
    const energyBarEl = document.getElementById(`${color}-energy-bar`);
    const mindBarEl = document.getElementById(`${color}-mind-bar`);
    
    if (energyEl) energyEl.textContent = resources.energy;
    if (mindEl) mindEl.textContent = resources.mind;
    
    // 更新进度条（假设最大100）
    if (energyBarEl) energyBarEl.style.width = `${Math.min(resources.energy, 100)}%`;
    if (mindBarEl) mindBarEl.style.width = `${Math.min(resources.mind, 50)}%`;
}

// 更新棋盘
function updateBoard(state) {
    // 清空棋盘
    document.querySelectorAll('.cell').forEach(cell => {
        cell.innerHTML = '';
        cell.className = 'cell';
        cell.title = '';
    });
    
    // 显示资源点
    state.board.forEach((row, x) => {
        row.forEach((cell, y) => {
            if (cell && cell.type) {
                const cellEl = document.getElementById(`cell_${x}_${y}`);
                if (cellEl) {
                    cellEl.classList.add('resource');
                    cellEl.innerHTML = resourceEmojis[cell.type] || '❓';
                    cellEl.title = `${cell.type}: ${cell.amount}剩余`;
                }
            }
        });
    });
    
    // 显示红方单位
    state.units.red.forEach(unit => {
        const cellEl = document.getElementById(`cell_${unit.x}_${unit.y}`);
        if (cellEl) {
            cellEl.classList.add('red');
            cellEl.innerHTML = unitEmojis[unit.type] || '❓';
            
            // 添加HP显示
            const hpEl = document.createElement('div');
            hpEl.className = 'unit-hp';
            hpEl.textContent = unit.hp;
            cellEl.appendChild(hpEl);
            
            cellEl.title = `${unit.id} (${unit.type}) HP: ${unit.hp}/${unit.maxHp}`;
        }
    });
    
    // 显示蓝方单位
    state.units.blue.forEach(unit => {
        const cellEl = document.getElementById(`cell_${unit.x}_${unit.y}`);
        if (cellEl) {
            cellEl.classList.add('blue');
            cellEl.innerHTML = unitEmojis[unit.type] || '❓';
            
            // 添加HP显示
            const hpEl = document.createElement('div');
            hpEl.className = 'unit-hp';
            hpEl.textContent = unit.hp;
            cellEl.appendChild(hpEl);
            
            cellEl.title = `${unit.id} (${unit.type}) HP: ${unit.hp}/${unit.maxHp}`;
        }
    });
}

// 高亮显示变化的单元格
function highlightChanges(state) {
    // 简单实现：暂时高亮所有单位单元格
    const allUnits = [...state.units.red, ...state.units.blue];
    
    allUnits.forEach(unit => {
        const cellEl = document.getElementById(`cell_${unit.x}_${unit.y}`);
        if (cellEl) {
            cellEl.classList.add('highlight');
            setTimeout(() => {
                cellEl.classList.remove('highlight');
            }, 500);
        }
    });
}

// 启动计时器
function startTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    timeLeft = 20;
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            addLog('回合超时，等待行动处理...', 'system');
        }
    }, 1000);
}

// 更新计时器显示
function updateTimerDisplay() {
    timerEl.textContent = `${timeLeft}s`;
    
    // 根据剩余时间改变颜色
    if (timeLeft <= 5) {
        timerEl.style.color = '#f5576c';
        timerEl.classList.add('pulse');
    } else if (timeLeft <= 10) {
        timerEl.style.color = '#ffb142';
        timerEl.classList.remove('pulse');
    } else {
        timerEl.style.color = '#4ecdc4';
        timerEl.classList.remove('pulse');
    }
}

// 添加日志
function addLog(message, type = 'system') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = `[${time}]`;
    
    const textSpan = document.createElement('span');
    textSpan.className = 'log-text';
    textSpan.textContent = message;
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(textSpan);
    logContent.appendChild(logEntry);
    
    // 自动滚动到底部
    logContent.scrollTop = logContent.scrollHeight;
}

// 清空日志
function clearLog() {
    logContent.innerHTML = '';
    addLog('日志已清空', 'system');
}

// 导出函数供HTML调用
window.joinAsSpectator = spectateDefaultGame;
window.newGame = createNewGame;