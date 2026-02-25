// 简单的AI Agent示例
const io = require('socket.io-client');

class SimpleAgent {
  constructor(name, serverUrl = 'http://localhost:3000') {
    this.name = name;
    this.serverUrl = serverUrl;
    this.socket = null;
    this.agentId = null;
    this.gameId = null;
    this.color = null;
    this.isConnected = false;
  }
  
  // 连接到服务器
  connect() {
    console.log(`[${this.name}] 连接到服务器: ${this.serverUrl}`);
    
    this.socket = io(this.serverUrl);
    
    this.socket.on('connect', () => {
      console.log(`[${this.name}] 连接成功`);
      this.isConnected = true;
      this.registerAgent();
    });
    
    this.socket.on('disconnect', () => {
      console.log(`[${this.name}] 断开连接`);
      this.isConnected = false;
    });
    
    this.socket.on('agent_registered', (data) => {
      console.log(`[${this.name}] Agent注册成功:`, data.id);
      this.agentId = data.id;
    });
    
    this.socket.on('game_state', (state) => {
      console.log(`[${this.name}] 收到游戏状态，回合 ${state.turn}`);
      this.processGameState(state);
    });
    
    this.socket.on('game_update', (state) => {
      console.log(`[${this.name}] 游戏状态更新，回合 ${state.turn}`);
      this.processGameState(state);
    });
    
    this.socket.on('player_joined', (data) => {
      console.log(`[${this.name}] ${data.color}方加入: ${data.agentId}`);
    });
    
    this.socket.on('game_over', (data) => {
      console.log(`[${this.name}] 游戏结束! 获胜方: ${data.winner}`);
    });
    
    this.socket.on('error', (data) => {
      console.error(`[${this.name}] 错误:`, data.message);
    });
  }
  
  // 注册Agent
  registerAgent() {
    if (!this.isConnected) return;
    
    this.socket.emit('agent_register', {
      name: this.name,
      type: 'ai'
    });
  }
  
  // 加入游戏
  joinGame(gameId, color) {
    if (!this.isConnected || !this.agentId) {
      console.log(`[${this.name}] 等待连接和注册...`);
      setTimeout(() => this.joinGame(gameId, color), 1000);
      return;
    }
    
    this.gameId = gameId;
    this.color = color;
    
    console.log(`[${this.name}] 加入游戏 ${gameId} 作为 ${color}方`);
    
    this.socket.emit('join_game', {
      gameId: gameId,
      color: color
    });
  }
  
  // 处理游戏状态并生成行动
  processGameState(state) {
    if (state.gameOver) {
      console.log(`[${this.name}] 游戏已结束`);
      return;
    }
    
    // 检查是否轮到我们行动
    if (state.actions[this.color] && state.actions[this.color].length > 0) {
      console.log(`[${this.name}] 已经提交了行动，等待结果`);
      return;
    }
    
    // 生成行动
    const actions = this.generateActions(state);
    
    if (actions.length > 0) {
      console.log(`[${this.name}] 提交 ${actions.length} 个行动`);
      
      this.socket.emit('submit_actions', {
        gameId: this.gameId,
        actions: actions
      });
    } else {
      console.log(`[${this.name}] 没有生成有效行动`);
    }
  }
  
  // 生成行动（简单策略）
  generateActions(state) {
    const actions = [];
    const myUnits = state.units[this.color];
    const opponentColor = this.color === 'red' ? 'blue' : 'red';
    const opponentUnits = state.units[opponentColor];
    
    // 简单策略：移动单位，攻击最近的敌人
    myUnits.forEach(unit => {
      // 50%概率移动
      if (Math.random() > 0.5 && state.resources[this.color].energy >= 4) {
        const directions = [
          [0, 1], [1, 0], [0, -1], [-1, 0],
          [1, 1], [1, -1], [-1, 1], [-1, -1]
        ];
        
        const [dx, dy] = directions[Math.floor(Math.random() * directions.length)];
        const newX = Math.max(0, Math.min(4, unit.x + dx));
        const newY = Math.max(0, Math.min(4, unit.y + dy));
        
        // 检查目标位置是否空闲
        const allUnits = [...myUnits, ...opponentUnits];
        const occupied = allUnits.find(u => u.x === newX && u.y === newY);
        
        if (!occupied) {
          actions.push({
            type: 'move',
            unitId: unit.id,
            x: newX,
            y: newY
          });
        }
      }
      
      // 如果有敌人附近，攻击
      if (opponentUnits.length > 0 && Math.random() > 0.7) {
        // 找到最近的敌人
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        opponentUnits.forEach(enemy => {
          const distance = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
          }
        });
        
        // 如果在攻击范围内，攻击
        const attackRange = unit.type === 'mage' ? 2 : 1;
        if (closestEnemy && closestDistance <= attackRange) {
          actions.push({
            type: 'attack',
            unitId: unit.id,
            targetId: closestEnemy.id
          });
        }
      }
    });
    
    return actions;
  }
  
  // 断开连接
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// 使用示例
if (require.main === module) {
  // 创建两个Agent进行对战
  const agent1 = new SimpleAgent('AlphaAgent');
  const agent2 = new SimpleAgent('BetaAgent');
  
  agent1.connect();
  agent2.connect();
  
  // 等待连接后加入游戏
  setTimeout(() => {
    const gameId = 'default_game'; // 或从服务器获取
    
    agent1.joinGame(gameId, 'red');
    
    setTimeout(() => {
      agent2.joinGame(gameId, 'blue');
    }, 2000);
    
  }, 3000);
  
  // 运行1分钟后断开
  setTimeout(() => {
    console.log('测试结束，断开连接');
    agent1.disconnect();
    agent2.disconnect();
    process.exit(0);
  }, 60000);
}

module.exports = SimpleAgent;