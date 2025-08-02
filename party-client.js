// Party Mode Client - Add this to your existing project
class PartyGameClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerName = '';
    this.roomCode = '';
    this.isHost = false;
    this.currentRoom = null;
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.serverUrl = 'wss://your-railway-app.railway.app'; // Replace with your Railway URL
  }

  // Initialize party mode
  init() {
    this.createPartyModeUI();
    this.setupDrawingCanvas();
  }

  // Connect to the backend server
  connect() {
    if (this.socket && this.isConnected) return;

    // Use Socket.io client (you'll need to include this in your HTML)
    this.socket = io(this.serverUrl, {
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      console.log('Connected to party server');
      this.isConnected = true;
      this.updateConnectionStatus('Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from party server');
      this.isConnected = false;
      this.updateConnectionStatus('Disconnected');
    });

    // Room events
    this.socket.on('room-created', (data) => {
      if (data.success) {
        this.roomCode = data.roomCode;
        this.currentRoom = data.room;
        this.isHost = true;
        this.showLobby();
      } else {
        this.showError(data.error);
      }
    });

    this.socket.on('room-joined', (data) => {
      if (data.success) {
        this.currentRoom = data.room;
        this.showLobby();
      } else {
        this.showError(data.error);
      }
    });

    this.socket.on('player-joined', (data) => {
      this.currentRoom = data.room;
      this.updatePlayerList();
      this.showMessage(`${data.player.name} joined the game!`);
    });

    this.socket.on('player-left', (data) => {
      this.currentRoom = data.room;
      this.updatePlayerList();
    });

    // Game events
    this.socket.on('game-started', (data) => {
      this.currentRoom = data.room;
      this.startPartyGamePhase(data.gameState);
    });

    this.socket.on('phase-changed', (data) => {
      this.currentRoom = data.room;
      this.startPartyGamePhase(data.gameState);
    });

    this.socket.on('timer-update', (data) => {
      this.handleTimerUpdate(data);
    });

    this.socket.on('drawing-submitted', (data) => {
      this.showMessage(`${data.playerName} finished drawing! (${data.totalSubmitted}/${data.totalPlayers})`);
    });

    this.socket.on('game-error', (data) => {
      this.showError(data.error);
    });
  }

  // Create party mode UI elements
  createPartyModeUI() {
    const container = document.querySelector('.container');
    
    // Add party mode toggle to start screen
    const startScreen = document.getElementById('start-screen');
    const partyModeSection = document.createElement('div');
    partyModeSection.id = 'party-mode-section';
    partyModeSection.className = 'party-mode-section hidden';
    
    partyModeSection.innerHTML = `
      <div class="party-mode-card">
        <h3>🎉 Party Mode</h3>
        <p>Play with friends on their phones!</p>
        
        <div id="party-connection-status" class="connection-status">
          <span class="status-indicator"></span>
          <span class="status-text">Not Connected</span>
        </div>
        
        <div id="party-setup" class="party-setup">
          <input type="text" id="player-name-input" placeholder="Your Name" maxlength="15">
          
          <div class="party-buttons">
            <button id="create-room-btn" class="party-btn create-btn">Create Room</button>
            <div class="join-room-section">
              <input type="text" id="join-room-code" placeholder="Room Code" maxlength="4">
              <button id="join-room-btn" class="party-btn join-btn">Join Room</button>
            </div>
          </div>
        </div>
        
        <div id="party-lobby" class="party-lobby hidden">
          <div class="room-info">
            <h4>Room: <span id="room-code-display"></span></h4>
            <div id="player-list"></div>
          </div>
          
          <div id="host-controls" class="host-controls hidden">
            <h4>Game Settings</h4>
            <div class="party-settings">
              <label>View Time: 
                <select id="party-view-time">
                  <option value="10">10 seconds</option>
                  <option value="15">15 seconds</option>
                  <option value="20" selected>20 seconds</option>
                  <option value="30">30 seconds</option>
                </select>
              </label>
              <label>Draw Time: 
                <select id="party-draw-time">
                  <option value="60">1 minute</option>
                  <option value="120" selected>2 minutes</option>
                  <option value="180">3 minutes</option>
                </select>
              </label>
            </div>
            <button id="start-party-game-btn" class="party-btn start-btn">Start Game</button>
          </div>
        </div>
        
        <div id="party-game-area" class="party-game-area hidden">
          <div id="party-status" class="party-status"></div>
          <div id="drawing-area" class="drawing-area hidden">
            <canvas id="party-canvas" width="300" height="300"></canvas>
            <div class="drawing-tools">
              <button id="clear-canvas">Clear</button>
              <input type="color" id="brush-color" value="#000000">
              <input type="range" id="brush-size" min="1" max="20" value="3">
              <button id="submit-drawing">Submit Drawing</button>
            </div>
          </div>
        </div>
        
        <button id="back-to-local" class="party-btn back-btn">← Back to Local Mode</button>
      </div>
    `;
    
    startScreen.appendChild(partyModeSection);
    
    // Add mode toggle buttons
    const modeToggle = document.createElement('div');
    modeToggle.className = 'mode-toggle';
    modeToggle.innerHTML = `
      <button id="local-mode-btn" class="mode-btn active">Local Mode</button>
      <button id="party-mode-btn" class="mode-btn">Party Mode</button>
    `;
    
    startScreen.insertBefore(modeToggle, startScreen.firstChild);
    
    this.setupPartyModeEventListeners();
  }

  setupPartyModeEventListeners() {
    // Mode toggle
    document.getElementById('local-mode-btn').addEventListener('click', () => {
      this.showLocalMode();
    });
    
    document.getElementById('party-mode-btn').addEventListener('click', () => {
      this.showPartyMode();
      if (!this.isConnected) {
        this.connect();
      }
    });

    // Party mode actions
    document.getElementById('create-room-btn').addEventListener('click', () => {
      this.createRoom();
    });

    document.getElementById('join-room-btn').addEventListener('click', () => {
      this.joinRoom();
    });

    document.getElementById('start-party-game-btn').addEventListener('click', () => {
      this.startPartyGame();
    });

    document.getElementById('back-to-local').addEventListener('click', () => {
      this.showLocalMode();
    });

    // Drawing canvas events will be set up in setupDrawingCanvas()
  }

  showLocalMode() {
    document.getElementById('local-mode-btn').classList.add('active');
    document.getElementById('party-mode-btn').classList.remove('active');
    document.getElementById('party-mode-section').classList.add('hidden');
    document.querySelector('.settings-group').classList.remove('hidden');
    document.getElementById('start-buttons').classList.remove('hidden');
  }

  showPartyMode() {
    document.getElementById('party-mode-btn').classList.add('active');
    document.getElementById('local-mode-btn').classList.remove('active');
    document.getElementById('party-mode-section').classList.remove('hidden');
    document.querySelector('.settings-group').classList.add('hidden');
    document.getElementById('start-buttons').classList.add('hidden');
  }

  createRoom() {
    const playerName = document.getElementById('player-name-input').value.trim();
    if (!playerName) {
      this.showError('Please enter your name');
      return;
    }

    this.playerName = playerName;
    this.socket.emit('create-room', { playerName });
  }

  joinRoom() {
    const playerName = document.getElementById('player-name-input').value.trim();
    const roomCode = document.getElementById('join-room-code').value.trim().toUpperCase();
    
    if (!playerName) {
      this.showError('Please enter your name');
      return;
    }
    
    if (!roomCode) {
      this.showError('Please enter room code');
      return;
    }

    this.playerName = playerName;
    this.socket.emit('join-room', { roomCode, playerName });
  }

  showLobby() {
    document.getElementById('party-setup').classList.add('hidden');
    document.getElementById('party-lobby').classList.remove('hidden');
    document.getElementById('room-code-display').textContent = this.roomCode || this.currentRoom.code;
    
    if (this.isHost) {
      document.getElementById('host-controls').classList.remove('hidden');
    }
    
    this.updatePlayerList();
  }

  updatePlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    this.currentRoom.players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-item';
      playerDiv.innerHTML = `
        <span class="player-name">${player.name}</span>
        ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
      `;
      playerList.appendChild(playerDiv);
    });
  }

  startPartyGame() {
    const viewTime = parseInt(document.getElementById('party-view-time').value);
    const drawTime = parseInt(document.getElementById('party-draw-time').value);
    
    this.socket.emit('start-game', { viewTime, drawTime });
  }

  startPartyGamePhase(gameState) {
    const gameArea = document.getElementById('party-game-area');
    const lobby = document.getElementById('party-lobby');
    const status = document.getElementById('party-status');
    const drawingArea = document.getElementById('drawing-area');
    
    lobby.classList.add('hidden');
    gameArea.classList.remove('hidden');
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    const isHost = this.isHost;
    
    switch (gameState.phase) {
      case 'studying':
        if (isMyTurn) {
          // Show monster image to current player
          status.innerHTML = `
            <h3>🎨 Study this monster carefully!</h3>
            <p>Round ${gameState.currentRound} - You'll describe it to others</p>
            <div class="monster-display">
              <img src="images/${gameState.currentMonster}" style="max-width: 300px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);" />
            </div>
          `;
          
          // Start timer if host
          if (isHost) {
            setTimeout(() => {
              this.socket.emit('start-phase-timer', {
                phase: 'studying',
                duration: gameState.viewTime
              });
            }, 1000);
          }
        } else if (isHost) {
          // Host screen - show controls and status
          status.innerHTML = `
            <h3>⏳ ${currentPlayer.name} is studying the monster...</h3>
            <p>Round ${gameState.currentRound} - Preparing for drawing phase</p>
            <div class="host-controls-active">
              <button id="skip-to-drawing" class="party-btn">Skip to Drawing</button>
            </div>
          `;
          
          // Add skip functionality
          setTimeout(() => {
            const skipBtn = document.getElementById('skip-to-drawing');
            if (skipBtn) {
              skipBtn.addEventListener('click', () => {
                this.socket.emit('advance-phase');
              });
            }
          }, 100);
        } else {
          // Other players
          status.innerHTML = `
            <h3>⏳ ${currentPlayer.name} is studying the monster...</h3>
            <p>Round ${gameState.currentRound} - Get ready to draw!</p>
          `;
        }
        drawingArea.classList.add('hidden');
        break;
        
      case 'drawing':
        if (isMyTurn) {
          if (isHost) {
            // Host/Drawer sees description interface
            status.innerHTML = `
              <h3>🎤 Describe the monster while others draw!</h3>
              <p>Guide your team with clear descriptions</p>
              <div class="host-controls-active">
                <button id="end-drawing-phase" class="party-btn">End Drawing Phase</button>
              </div>
            `;
            
            // Add end drawing functionality
            setTimeout(() => {
              const endBtn = document.getElementById('end-drawing-phase');
              if (endBtn) {
                endBtn.addEventListener('click', () => {
                  this.socket.emit('advance-phase');
                });
              }
            }, 100);
          } else {
            status.innerHTML = `
              <h3>🎤 Describe the monster while others draw!</h3>
              <p>Use the main screen if you're the host</p>
            `;
          }
          drawingArea.classList.add('hidden');
          
          // Start drawing timer if host
          if (isHost) {
            setTimeout(() => {
              this.socket.emit('start-phase-timer', {
                phase: 'drawing',
                duration: gameState.drawTime
              });
            }, 1000);
          }
        } else {
          // Other players draw
          status.innerHTML = `
            <h3>✏️ Draw what ${currentPlayer.name} describes!</h3>
            <p>Listen carefully and draw on the canvas below</p>
          `;
          drawingArea.classList.remove('hidden');
          this.clearCanvas();
        }
        break;
        
      case 'reveal':
        if (isHost) {
          // Host screen shows all drawings in a gallery
          status.innerHTML = `
            <h3>🎉 Round ${gameState.currentRound} Complete!</h3>
            <p>Here are all the drawings compared to the original:</p>
            <div class="drawings-gallery" id="drawings-gallery">
              <div class="original-monster">
                <h4>Original Monster</h4>
                <img src="images/${gameState.currentMonster}" style="max-width: 200px; border-radius: 8px;" />
              </div>
              ${gameState.drawings.map(drawing => `
                <div class="player-drawing">
                  <h4>${drawing.playerName}</h4>
                  <img src="${drawing.imageData}" style="max-width: 200px; border-radius: 8px;" />
                </div>
              `).join('')}
            </div>
            <div class="host-controls-active">
              <button id="next-round-btn" class="party-btn">Next Round</button>
              <button id="end-game-btn" class="party-btn" style="background: #e74c3c;">End Game</button>
            </div>
          `;
          
          // Add next round functionality
          setTimeout(() => {
            const nextBtn = document.getElementById('next-round-btn');
            const endBtn = document.getElementById('end-game-btn');
            if (nextBtn) {
              nextBtn.addEventListener('click', () => {
                this.socket.emit('advance-phase');
              });
            }
            if (endBtn) {
              endBtn.addEventListener('click', () => {
                // End game logic
                this.showLobby();
              });
            }
          }, 100);
        } else {
          status.innerHTML = `
            <h3>🎉 Round ${gameState.currentRound} Complete!</h3>
            <p>Check the main screen to see all drawings and the original monster!</p>
          `;
        }
        drawingArea.classList.add('hidden');
        break;
        
      case 'finished':
        status.innerHTML = `
          <h3>🏆 Game Complete!</h3>
          <p>Thanks for playing! The host can start a new game.</p>
        `;
        drawingArea.classList.add('hidden');
        break;
    }
  }

  // Handle timer updates
  handleTimerUpdate(data) {
    const { timeLeft, phase } = data;
    
    // Show timer countdown in status area
    const timerDisplay = document.getElementById('party-timer-display');
    if (!timerDisplay) {
      const status = document.getElementById('party-status');
      const timer = document.createElement('div');
      timer.id = 'party-timer-display';
      timer.className = 'party-timer';
      status.appendChild(timer);
    }
    
    const timer = document.getElementById('party-timer-display');
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Add warning class for last 10 seconds
    if (timeLeft <= 10) {
      timer.classList.add('timer-warning');
    } else {
      timer.classList.remove('timer-warning');
    }
  }

  setupDrawingCanvas() {
    // Will be called when drawing area is shown
    document.addEventListener('DOMContentLoaded', () => {
      const canvas = document.getElementById('party-canvas');
      if (!canvas) return;
      
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      
      // Set up drawing event listeners
      canvas.addEventListener('mousedown', this.startDrawing.bind(this));
      canvas.addEventListener('mousemove', this.draw.bind(this));
      canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
      canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
      
      // Touch events for mobile
      canvas.addEventListener('touchstart', this.handleTouch.bind(this));
      canvas.addEventListener('touchmove', this.handleTouch.bind(this));
      canvas.addEventListener('touchend', this.stopDrawing.bind(this));
      
      // Tool controls
      document.getElementById('clear-canvas').addEventListener('click', () => {
        this.clearCanvas();
      });
      
      document.getElementById('submit-drawing').addEventListener('click', () => {
        this.submitDrawing();
      });
    });
  }

  startDrawing(e) {
    this.isDrawing = true;
    this.draw(e);
  }

  draw(e) {
    if (!this.isDrawing) return;
    
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const color = document.getElementById('brush-color').value;
    const size = document.getElementById('brush-size').value;
    
    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = color;
    
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  stopDrawing() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.ctx.beginPath();
  }

  handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' : 
                                     e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    this.canvas.dispatchEvent(mouseEvent);
  }

  clearCanvas() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  submitDrawing() {
    if (!this.canvas) return;
    
    const imageData = this.canvas.toDataURL();
    this.socket.emit('submit-drawing', {
      imageData: imageData
    });
    
    // Hide drawing area and show waiting message
    document.getElementById('drawing-area').classList.add('hidden');
    document.getElementById('party-status').innerHTML = `
      <h3>✅ Drawing Submitted!</h3>
      <p>Waiting for other players to finish...</p>
    `;
  }

  updateConnectionStatus(status) {
    const statusElement = document.getElementById('party-connection-status');
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('.status-text');
    
    text.textContent = status;
    
    if (status === 'Connected') {
      indicator.className = 'status-indicator connected';
    } else {
      indicator.className = 'status-indicator disconnected';
    }
  }

  showError(message) {
    // You can integrate this with your existing error display system
    alert(`Party Mode Error: ${message}`);
  }

  showMessage(message) {
    // You can integrate this with your existing message system
    console.log(`Party Mode: ${message}`);
    
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'party-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// Initialize party mode when DOM is loaded
let partyClient = null;

document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're not in an iframe (to avoid conflicts)
  if (window.self === window.top) {
    partyClient = new PartyGameClient();
    partyClient.init();
  }
});