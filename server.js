const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 静态文件服务
app.use(express.static(path.join(__dirname)));
app.use(express.json());

// 游戏状态存储
let games = {};
let agents = {}; // 注册的Agent

// 创建新游戏
function createNewGame() {
  const gameId = 'game_' + Date.now();
  
  const game = {
    id: gameId,
    players: {},
    spectators: new Set(),
    state: {
      turn: 1,
      board: createBoard(),
      resources: {
        red: { energy: 50, mind: 30 },
        blue: { energy: 50, mind: 30 }
      },
      units: {
        red: [
          { id: 'R1', type: 'scout', hp: 30, x: 0, y: 0, maxHp: 30 },
          { id: 'R2', type: 'warrior', hp: 50, x: 4, y: 0, maxHp: 50 }
        ],
        blue: [
          { id: 'B1', type: 'warrior', hp: 50, x: 0, y: 4, maxHp: 50 },
          { id: 'B2', type: 'scout', hp: 30, x: 4, y: 4, maxHp: 30 }
        ]
      },
      actions: {
        red: [],
        blue: []
      },
      winner: null,
      gameOver: false
    },
    timer: null,
    currentTurn: 'red' // 红方先手
  };
  
  games[gameId] = game;
  return game;
}

// 创建5×5棋盘
function createBoard() {
  const board = Array(5).fill().map(() => Array(5).fill(null));
  
  // 设置资源点
  const resources = [
    [1, 1, 'gem'], [1, 2, 'energy'], [1, 3, 'mind'],
    [2, 1, 'energy'], [2, 2, 'gem'], [2, 3, 'energy'],
    [3, 1, 'mind'], [3, 2, 'energy'], [3, 3, 'gem']
  ];
  
  resources.forEach(([x, y, type]) => {
    board[x][y] = { type, amount: 10 };
  });
  
  return board;
}

// 处理单位移动
function moveUnit(game, unitId, color, targetX, targetY) {
  const unit = game.state.units[color].find(u => u.id === unitId);
  if (!unit) return false;
  
  // 检查目标位置是否合法
  if (targetX < 0 || targetX >= 5 || targetY < 0 || targetY >= 5) return false;
  
  // 检查是否有其他单位
  const allUnits = [...game.state.units.red, ...game.state.units.blue];
  const occupied = allUnits.find(u => u.x === targetX && u.y === targetY);
  if (occupied) return false;
  
  // 计算移动距离
  const distance = Math.abs(unit.x - targetX) + Math.abs(unit.y - targetY);
  const maxMove = unit.type === 'scout' ? 3 : unit.type === 'warrior' ? 2 : 1;
  
  if (distance > maxMove) return false;
  
  // 消耗能量
  const energyCost = distance * 2;
  if (game.state.resources[color].energy < energyCost) return false;
  
  game.state.resources[color].energy -= energyCost;
  
  // 移动单位
  unit.x = targetX;
  unit.y = targetY;
  
  // 检查是否收集资源
  const cell = game.state.board[targetX][targetY];
  if (cell && cell.amount > 0) {
    if (cell.type === 'energy') {
      game.state.resources[color].energy += 5;
    } else if (cell.type === 'mind') {
      game.state.resources[color].mind += 5;
    } else if (cell.type === 'gem') {
      game.state.resources[color].energy += 3;
      game.state.resources[color].mind += 3;
    }
    cell.amount = Math.max(0, cell.amount - 5);
  }
  
  return true;
}

// 处理攻击
function attackUnit(game, attackerId, color, targetId) {
  const attacker = game.state.units[color].find(u => u.id === attackerId);
  const targetColor = targetId.startsWith('R') ? 'red' : 'blue';
  const target = game.state.units[targetColor].find(u => u.id === targetId);
  
  if (!attacker || !target) return false;
  
  // 检查攻击距离
  const distance = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y);
  const attackRange = attacker.type === 'mage' ? 2 : 1;
  
  if (distance > attackRange) return false;
  
  // 计算伤害
  const baseDamage = attacker.type === 'warrior' ? 10 : 
                     attacker.type === 'mage' ? 8 : 5;
  
  target.hp -= baseDamage;
  
  // 如果目标死亡，移除单位
  if (target.hp <= 0) {
    game.state.units[targetColor] = game.state.units[targetColor].filter(u => u.id !== targetId);
  }
  
  return true;
}

// 检查胜利条件
function checkVictory(game) {
  // 1. 消灭所有对手单位
  if (game.state.units.red.length === 0) {
    return 'blue';
  }
  if (game.state.units.blue.length === 0) {
    return 'red';
  }
  
  // 2. 占领基地
  const redBase = { x: 0, y: 0 };
  const blueBase = { x: 0, y: 4 };
  
  const redOnBlueBase = game.state.units.red.some(u => u.x === blueBase.x && u.y === blueBase.y);
  const blueOnRedBase = game.state.units.blue.some(u => u.x === redBase.x && u.y === redBase.y);
  
  if (redOnBlueBase && !blueOnRedBase) {
    return 'red';
  }
  if (blueOnRedBase && !redOnBlueBase) {
    return 'blue';
  }
  
  // 3. 资源胜利
  if (game.state.resources.red.energy >= 100 && game.state.resources.red.mind >= 50) {
    return 'red';
  }
  if (game.state.resources.blue.energy >= 100 && game.state.resources.blue.mind >= 50) {
    return 'blue';
  }
  
  return null;
}

// REST API端点
app.get('/api/games', (req, res) => {
  res.json(Object.keys(games).map(id => ({
    id,
    players: games[id].players,
    turn: games[id].state.turn
  })));
});

app.post('/api/games/new', (req, res) => {
  const game = createNewGame();
  res.json({ gameId: game.id, message: 'Game created' });
});

app.post('/api/agents/register', (req, res) => {
  const { name, type = 'ai' } = req.body;
  const agentId = 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  
  agents[agentId] = {
    id: agentId,
    name,
    type,
    registeredAt: new Date()
  };
  
  res.json({ agentId, ...agents[agentId] });
});

app.post('/api/games/:gameId/join', (req, res) => {
  const { gameId } = req.params;
  const { agentId, color } = req.body;
  
  if (!games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  if (!agents[agentId]) {
    return res.status(400).json({ error: 'Agent not registered' });
  }
  
  const game = games[gameId];
  
  if (game.players[color]) {
    return res.status(400).json({ error: 'Color already taken' });
  }
  
  game.players[color] = agentId;
  
  res.json({ 
    success: true, 
    gameId, 
    color,
    state: game.state
  });
});

app.get('/api/games/:gameId/spectate', (req, res) => {
  const { gameId } = req.params;
  
  if (!games[gameId]) {
    return res.status(404).json({ error: 'Game not found' });
  }
  
  res.json(games[gameId].state);
});

// WebSocket连接处理
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Agent注册
  socket.on('agent_register', (data) => {
    const agentId = 'agent_' + socket.id;
    agents[agentId] = {
      id: agentId,
      name: data.name || 'Unknown Agent',
      type: data.type || 'ai',
      socketId: socket.id
    };
    
    socket.agentId = agentId;
    socket.emit('agent_registered', agents[agentId]);
  });
  
  // 加入游戏
  socket.on('join_game', (data) => {
    const { gameId, color } = data;
    
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    const game = games[gameId];
    
    if (game.players[color]) {
      socket.emit('error', { message: 'Color already taken' });
      return;
    }
    
    game.players[color] = socket.agentId || socket.id;
    socket.gameId = gameId;
    socket.color = color;
    socket.join(gameId);
    
    // 发送游戏状态
    socket.emit('game_state', game.state);
    
    // 通知所有观战者
    io.to(gameId).emit('player_joined', {
      color,
      agentId: socket.agentId || socket.id
    });
    
    // 如果双方都加入了，开始游戏
    if (game.players.red && game.players.blue && !game.timer) {
      startGameTimer(game);
    }
  });
  
  // 提交行动
  socket.on('submit_actions', (data) => {
    const { gameId, actions } = data;
    const game = games[gameId];
    
    if (!game || !socket.color) {
      socket.emit('error', { message: 'Invalid game or color' });
      return;
    }
    
    if (game.currentTurn !== socket.color) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    // 存储行动
    game.state.actions[socket.color] = actions;
    
    // 检查是否双方都提交了行动
    if (game.state.actions.red.length > 0 && game.state.actions.blue.length > 0) {
      processTurn(game);
    }
  });
  
  // 观战
  socket.on('spectate_game', (gameId) => {
    if (!games[gameId]) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    socket.join(gameId);
    socket.emit('game_state', games[gameId].state);
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
  });
});

// 开始游戏计时器
function startGameTimer(game) {
  console.log(`Starting game ${game.id}`);
  
  game.timer = setInterval(() => {
    // 如果双方都提交了行动，处理回合
    if (game.state.actions.red.length > 0 && game.state.actions.blue.length > 0) {
      processTurn(game);
    } else {
      // 超时处理：自动生成简单行动
      if (game.state.actions[game.currentTurn].length === 0) {
        generateAutoActions(game, game.currentTurn);
      }
    }
  }, 20000); // 20秒一个回合
}

// 处理回合
function processTurn(game) {
  console.log(`Processing turn ${game.state.turn} for game ${game.id}`);
  
  // 执行红方行动
  game.state.actions.red.forEach(action => {
    if (action.type === 'move') {
      moveUnit(game, action.unitId, 'red', action.x, action.y);
    } else if (action.type === 'attack') {
      attackUnit(game, action.unitId, 'red', action.targetId);
    }
  });
  
  // 执行蓝方行动
  game.state.actions.blue.forEach(action => {
    if (action.type === 'move') {
      moveUnit(game, action.unitId, 'blue', action.x, action.y);
    } else if (action.type === 'attack') {
      attackUnit(game, action.unitId, 'blue', action.targetId);
    }
  });
  
  // 检查胜利
  const winner = checkVictory(game);
  if (winner) {
    game.state.winner = winner;
    game.state.gameOver = true;
    clearInterval(game.timer);
    game.timer = null;
  }
  
  // 更新回合
  game.state.turn++;
  game.currentTurn = game.currentTurn === 'red' ? 'blue' : 'red';
  
  // 清空行动
  game.state.actions.red = [];
  game.state.actions.blue = [];
  
  // 每回合自动增加资源
  game.state.resources.red.energy += 5;
  game.state.resources.red.mind += 2;
  game.state.resources.blue.energy += 5;
  game.state.resources.blue.mind += 2;
  
  // 广播更新
  io.to(game.id).emit('game_update', game.state);
  
  if (game.state.gameOver) {
    io.to(game.id).emit('game_over', { winner: game.state.winner });
  }
}

// 自动生成行动（用于超时）
function generateAutoActions(game, color) {
  const units = game.state.units[color];
  const actions = [];
  
  units.forEach(unit => {
    // 简单策略：移动到最近的资源或敌人
    if (Math.random() > 0.5) {
      // 移动
      const directions = [[0,1], [1,0], [0,-1], [-1,0]];
      const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
      const newX = Math.max(0, Math.min(4, unit.x + dx));
      const newY = Math.max(0, Math.min(4, unit.y + dy));
      
      actions.push({
        type: 'move',
        unitId: unit.id,
        x: newX,
        y: newY
      });
    }
  });
  
  game.state.actions[color] = actions;
}

// 创建默认游戏
const defaultGame = createNewGame();
console.log(`Default game created: ${defaultGame.id}`);

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MindMatrix Lite server running on port ${PORT}`);
  console.log(`Default game ID: ${defaultGame.id}`);
  console.log(`Web interface: http://localhost:${PORT}`);
  console.log(`API documentation available at /api-docs`);
});

// 简单API文档
app.get('/api-docs', (req, res) => {
  res.send(`
    <h1>MindMatrix Lite API Documentation</h1>
    <h2>REST API</h2>
    <ul>
      <li>GET /api/games - List all games</li>
      <li>POST /api/games/new - Create new game</li>
      <li>POST /api/agents/register - Register agent</li>
      <li>POST /api/games/:gameId/join - Join game</li>
      <li>GET /api/games/:gameId/spectate - Spectate game</li>
    </ul>
    <h2>WebSocket Events</h2>
    <ul>
      <li>agent_register - Register as agent</li>
      <li>join_game - Join a game</li>
      <li>submit_actions - Submit actions for current turn</li>
      <li>spectate_game - Spectate a game</li>
    </ul>
  `);
});