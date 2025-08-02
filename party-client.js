// Enhanced Party Mode Client - Supports both Main Screen and Player modes
class PartyGameClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerName = '';
    this.roomCode = '';
    this.isHost = false;
    this.isMainScreen = false;
    this.currentRoom = null;
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.gameTimer = null;
    this.serverUrl = 'https://drawblins-production.up.railway.app';
  }

  // Initialize party mode
  init() {
    console.log('Initializing Enhanced Party Mode...');
    this.createPartyModeUI();
    this.setupDrawingCanvas();
  }

  // Connect to the backend server
  connect() {
    if (this.socket && this.isConnected) return;

    console.log('Connecting to:', this.serverUrl);
    
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to party server');
      this.isConnected = true;
      this.updateConnectionStatus('Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from party server');
      this.isConnected = false;
      this.updateConnectionStatus('Disconnected');
      this.cleanup();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.updateConnectionStatus('Connection Failed');
      this.showError('Failed to connect to server');
    });

    // Room events
    this.socket.on('room-created', (data) => {
      console.log('Room created response:', data);
      if (data.success) {
        this.roomCode = data.roomCode;
        this.currentRoom = data.room;
        this.isHost = true;
        this.isMainScreen = data.isMainScreen;
        this.showLobby();
        console.log('✅ Room created successfully:', data.roomCode);
      } else {
        console.error('❌ Room creation failed:', data.error);
        this.showError(data.error);
      }
    });

    this.socket.on('room-joined', (data) => {
      console.log('Room joined response:', data);
      if (data.success) {
        this.currentRoom = data.room;
        this.isMainScreen = data.isMainScreen;
        this.showLobby();
        console.log('✅ Joined room successfully');
      } else {
        console.error('❌ Failed to join room:', data.error);
        this.showError(data.error);
      }
    });

    this.socket.on('player-joined', (data) => {
      console.log('Player joined:', data);
      this.currentRoom = data.room;
      this.updatePlayerList();
      if (!this.isMainScreen) {
        this.showMessage(`${data.player.name} joined the game!`);
      }
    });

    this.socket.on('player-left', (data) => {
      console.log('Player left:', data);
      this.currentRoom = data.room;
      this.updatePlayerList();
      
      if (data.wasMainScreen) {
        this.showError('Main screen disconnected!');
      }
    });

    // Game events
    this.socket.on('game-started', (data) => {
      console.log('Game started:', data);
      this.currentRoom = data.room;
      this.handleGamePhase(data.gameState);
    });

    this.socket.on('phase-changed', (data) => {
      console.log('Phase changed:', data);
      this.currentRoom = data.room;
      this.handleGamePhase(data.gameState, data);
    });

    this.socket.on('monster-revealed', (data) => {
      console.log('Monster revealed to me:', data);
      this.showMonsterToDrawer(data.monster, data.viewTime);
    });

    this.socket.on('timer-update', (data) => {
      this.updateGameTimer(data.timeLeft, data.phase);
    });

    this.socket.on('drawing-submitted', (data) => {
      console.log('Drawing submitted:', data);
      this.updateDrawingProgress(data);
    });

    this.socket.on('game-finished', (data) => {
      console.log('Game finished:', data);
      this.handleGameFinished(data);
    });

    this.socket.on('main-screen-disconnected', () => {
      this.showError('Main screen disconnected! Game paused.');
    });

    this.socket.on('game-error', (data) => {
      console.error('Game error:', data);
      this.showError(data.error);
    });

    this.socket.on('drawing-error', (data) => {
      console.error('Drawing error:', data);
      this.showError(data.error);
    });
  }

  // Create enhanced party mode UI
  createPartyModeUI() {
    console.log('Creating Enhanced Party Mode UI...');
    const container = document.querySelector('.container');
    
    // Check if already exists
    if (document.getElementById('party-mode-section')) {
      console.log('Party mode UI already exists');
      return;
    }
    
    const startScreen = document.getElementById('start-screen');
    
    // Add party mode section
    const partyModeSection = document.createElement('div');
    partyModeSection.id = 'party-mode-section';
    partyModeSection.className = 'party-mode-section hidden';
    
    partyModeSection.innerHTML = `
      <div class="party-mode-card">
        <h3>🎉 Party Mode</h3>
        <p>Play like Jackbox Games - one main screen, everyone else uses their phones!</p>
        
        <div id="party-connection-status" class="connection-status">
          <span class="status-indicator"></span>
          <span class="status-text">Not Connected</span>
        </div>
        
        <!-- Mode Selection -->
        <div id="party-mode-selection" class="party-mode-selection">
          <h4>Choose Your Role:</h4>
          <div class="mode-buttons">
            <button id="main-screen-btn" class="party-btn mode-btn">
              📺 Main Screen
              <small>Connect to TV/shared display</small>
            </button>
            <button id="player-phone-btn" class="party-btn mode-btn">
              📱 Player
              <small>Use phone as controller</small>
            </button>
          </div>
        </div>
        
        <!-- Setup Form -->
        <div id="party-setup" class="party-setup hidden">
          <input type="text" id="player-name-input" placeholder="Your Name" maxlength="15">
          
          <div class="party-buttons">
            <button id="create-room-btn" class="party-btn create-btn">Create Room</button>
            <div class="join-room-section">
              <input type="text" id="join-room-code" placeholder="Room Code" maxlength="4">
              <button id="join-room-btn" class="party-btn join-btn">Join Room</button>
            </div>
          </div>
        </div>
        
        <!-- Lobby -->
        <div id="party-lobby" class="party-lobby hidden">
          <div class="room-info">
            <h4>Room: <span id="room-code-display"></span></h4>
            <div id="connection-info" class="connection-info">
              <div id="main-screen-status" class="status-item">
                📺 Main Screen: <span class="status-value">Not Connected</span>
              </div>
              <div id="player-count-status" class="status-item">
                👥 Players: <span class="status-value">0</span>
              </div>
            </div>
            <div id="player-list"></div>
          </div>
          
          <!-- Host Controls (only for host) -->
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
              <label>Difficulty: 
                <select id="party-difficulty">
                  <option value="easy">Easy (1-158)</option>
                  <option value="standard" selected>Standard (159-266)</option>
                  <option value="all">All (1-266)</option>
                </select>
              </label>
            </div>
            <button id="start-party-game-btn" class="party-btn start-btn">Start Game</button>
          </div>
        </div>
        
        <!-- Game Area -->
        <div id="party-game-area" class="party-game-area hidden">
          <div id="party-status" class="party-status"></div>
          <div id="party-timer" class="party-timer hidden">00:00</div>
          
          <!-- Main Screen View -->
          <div id="main-screen-view" class="main-screen-view hidden">
            <div id="main-game-info" class="main-game-info"></div>
            <div id="main-drawings-display" class="main-drawings-display hidden"></div>
          </div>
          
          <!-- Player View -->
          <div id="player-view" class="player-view hidden">
            <!-- Monster viewing (for current drawer only) -->
            <div id="monster-view" class="monster-view hidden">
              <h3>Study This Monster!</h3>
              <img id="party-monster-image" src="" alt="Monster to draw">
              <p>Memorize it - you'll need to describe it to others!</p>
            </div>
            
            <!-- Drawing area (for non-drawers) -->
            <div id="drawing-area" class="drawing-area hidden">
              <h3>Draw What You Hear!</h3>
              <p>Listen to the drawer's description and draw what they describe.</p>
              <canvas id="party-canvas" width="300" height="300"></canvas>
              <div class="drawing-tools">
                <button id="clear-canvas">Clear</button>
                <input type="color" id="brush-color" value="#000000">
                <input type="range" id="brush-size" min="1" max="20" value="3">
                <button id="submit-drawing">Submit Drawing</button>
              </div>
            </div>
            
            <!-- Waiting area -->
            <div id="waiting-area" class="waiting-area hidden">
              <h3 id="waiting-title">Waiting...</h3>
              <p id="waiting-message">Please wait for the game to continue.</p>
            </div>
          </div>
        </div>
        
        <button id="back-to-local" class="party-btn back-btn">← Back to Local Mode</button>
      </div>
    `;
    
    startScreen.appendChild(partyModeSection);
    
    // Add mode toggle buttons
    let modeToggle = document.querySelector('.mode-toggle');
    if (!modeToggle) {
      modeToggle = document.createElement('div');
      modeToggle.className = 'mode-toggle';
      modeToggle.innerHTML = `
        <button id="local-mode-btn" class="mode-btn active">Local Mode</button>
        <button id="party-mode-btn" class="mode-btn">Party Mode</button>
      `;
      
      startScreen.insertBefore(modeToggle, startScreen.firstChild);
    }
    
    this.setupPartyModeEventListeners();
    console.log('✅ Enhanced Party Mode UI created');
  }

  setupPartyModeEventListeners() {
    console.log('Setting up event listeners...');
    
    // Mode toggle
    const localBtn = document.getElementById('local-mode-btn');
    const partyBtn = document.getElementById('party-mode-btn');
    
    if (localBtn) {
      localBtn.addEventListener('click', () => {
        console.log('Switching to Local Mode');
        this.showLocalMode();
      });
    }
    
    if (partyBtn) {
      partyBtn.addEventListener('click', () => {
        console.log('Switching to Party Mode');
        this.showPartyMode();
        if (!this.isConnected) {
          this.connect();
        }
      });
    }

    // Mode selection buttons
    const mainScreenBtn = document.getElementById('main-screen-btn');
    const playerPhoneBtn = document.getElementById('player-phone-btn');
    
    if (mainScreenBtn) {
      mainScreenBtn.addEventListener('click', () => {
        console.log('Selected Main Screen mode');
        this.isMainScreen = true;
        this.showSetupForm();
      });
    }
    
    if (playerPhoneBtn) {
      playerPhoneBtn.addEventListener('click', () => {
        console.log('Selected Player mode');
        this.isMainScreen = false;
        this.showSetupForm();
      });
    }

    // Party mode actions
    const createBtn = document.getElementById('create-room-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        console.log('Create room button clicked');
        this.createRoom();
      });
    }

    const joinBtn = document.getElementById('join-room-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        console.log('Join room button clicked');
        this.joinRoom();
      });
    }

    const startGameBtn = document.getElementById('start-party-game-btn');
    if (startGameBtn) {
      startGameBtn.addEventListener('click', () => {
        console.log('Start party game button clicked');
        this.startPartyGame();
      });
    }

    const backBtn = document.getElementById('back-to-local');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        console.log('Back to local button clicked');
        this.showLocalMode();
        this.cleanup();
      });
    }

    // Drawing tools
    const clearBtn = document.getElementById('clear-canvas');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearCanvas();
      });
    }

    const submitBtn = document.getElementById('submit-drawing');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        this.submitDrawing();
      });
    }

    console.log('✅ Event listeners set up');
  }

  showLocalMode() {
    console.log('Showing Local Mode');
    const localBtn = document.getElementById('local-mode-btn');
    const partyBtn = document.getElementById('party-mode-btn');
    const partySection = document.getElementById('party-mode-section');
    const settingsGroup = document.querySelector('.settings-group');
    const startButtons = document.getElementById('start-buttons');
    
    if (localBtn) localBtn.classList.add('active');
    if (partyBtn) partyBtn.classList.remove('active');
    if (partySection) partySection.classList.add('hidden');
    if (settingsGroup) settingsGroup.classList.remove('hidden');
    if (startButtons) startButtons.classList.remove('hidden');
    
    this.cleanup();
  }

  showPartyMode() {
    console.log('Showing Party Mode');
    const localBtn = document.getElementById('local-mode-btn');
    const partyBtn = document.getElementById('party-mode-btn');
    const partySection = document.getElementById('party-mode-section');
    const settingsGroup = document.querySelector('.settings-group');
    const startButtons = document.getElementById('start-buttons');
    
    if (partyBtn) partyBtn.classList.add('active');
    if (localBtn) localBtn.classList.remove('active');
    if (partySection) partySection.classList.remove('hidden');
    if (settingsGroup) settingsGroup.classList.add('hidden');
    if (startButtons) startButtons.classList.add('hidden');
    
    // Show mode selection
    this.showModeSelection();
  }

  showModeSelection() {
    const modeSelection = document.getElementById('party-mode-selection');
    const partySetup = document.getElementById('party-setup');
    const partyLobby = document.getElementById('party-lobby');
    const partyGameArea = document.getElementById('party-game-area');
    
    if (modeSelection) modeSelection.classList.remove('hidden');
    if (partySetup) partySetup.classList.add('hidden');
    if (partyLobby) partyLobby.classList.add('hidden');
    if (partyGameArea) partyGameArea.classList.add('hidden');
  }

  showSetupForm() {
    const modeSelection = document.getElementById('party-mode-selection');
    const partySetup = document.getElementById('party-setup');
    const playerNameInput = document.getElementById('player-name-input');
    
    if (modeSelection) modeSelection.classList.add('hidden');
    if (partySetup) partySetup.classList.remove('hidden');
    
    // Update placeholder based on mode
    if (playerNameInput) {
      if (this.isMainScreen) {
        playerNameInput.placeholder = "Game Name (optional)";
        playerNameInput.value = "Main Screen";
      } else {
        playerNameInput.placeholder = "Your Name";
        playerNameInput.value = "";
      }
    }
  }

  createRoom() {
    console.log('Creating room...');
    const playerNameInput = document.getElementById('player-name-input');
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    
    const finalName = playerName || (this.isMainScreen ? 'Main Screen' : '');
    
    console.log('Player name:', finalName, 'Is main screen:', this.isMainScreen);
    
    if (!finalName && !this.isMainScreen) {
      console.error('❌ No player name entered');
      this.showError('Please enter your name');
      return;
    }

    if (!this.socket || !this.isConnected) {
      console.error('❌ Not connected to server');
      this.showError('Not connected to server. Please try again.');
      return;
    }

    this.playerName = finalName;
    console.log('Emitting create-room event...');
    this.socket.emit('create-room', { 
      playerName: finalName,
      isMainScreen: this.isMainScreen
    });
  }

  joinRoom() {
    console.log('Joining room...');
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('join-room-code');
    
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';
    
    const finalName = playerName || (this.isMainScreen ? 'Main Screen' : '');
    
    console.log('Player name:', finalName, 'Room code:', roomCode, 'Is main screen:', this.isMainScreen);
    
    if (!finalName && !this.isMainScreen) {
      this.showError('Please enter your name');
      return;
    }
    
    if (!roomCode) {
      this.showError('Please enter room code');
      return;
    }

    if (!this.socket || !this.isConnected) {
      this.showError('Not connected to server. Please try again.');
      return;
    }

    this.playerName = finalName;
    console.log('Emitting join-room event...');
    this.socket.emit('join-room', { 
      roomCode, 
      playerName: finalName,
      isMainScreen: this.isMainScreen
    });
  }

  showLobby() {
    console.log('Showing lobby...');
    const partySetup = document.getElementById('party-setup');
    const partyLobby = document.getElementById('party-lobby');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const hostControls = document.getElementById('host-controls');
    
    if (partySetup) partySetup.classList.add('hidden');
    if (partyLobby) partyLobby.classList.remove('hidden');
    if (roomCodeDisplay) roomCodeDisplay.textContent = this.roomCode || this.currentRoom.code;
    
    // Show host controls only for host
    if (this.isHost && hostControls) {
      hostControls.classList.remove('hidden');
    }
    
    this.updateConnectionInfo();
    this.updatePlayerList();
    console.log('✅ Lobby shown');
  }

  updateConnectionInfo() {
    const mainScreenStatus = document.getElementById('main-screen-status');
    const playerCountStatus = document.getElementById('player-count-status');
    
    if (!this.currentRoom) return;
    
    const hasMainScreen = !!this.currentRoom.mainScreenId;
    const playerCount = this.currentRoom.players.filter(p => !p.isMainScreen).length;
    
    if (mainScreenStatus) {
      const statusValue = mainScreenStatus.querySelector('.status-value');
      if (statusValue) {
        statusValue.textContent = hasMainScreen ? 'Connected ✅' : 'Not Connected ❌';
        statusValue.style.color = hasMainScreen ? '#4CAF50' : '#f44336';
      }
    }
    
    if (playerCountStatus) {
      const statusValue = playerCountStatus.querySelector('.status-value');
      if (statusValue) {
        statusValue.textContent = `${playerCount}`;
        statusValue.style.color = playerCount >= 2 ? '#4CAF50' : '#f44336';
      }
    }
  }

  updatePlayerList() {
    const playerList = document.getElementById('player-list');
    if (!playerList || !this.currentRoom) return;
    
    playerList.innerHTML = '';
    
    // Separate main screen and players
    const mainScreenPlayer = this.currentRoom.players.find(p => p.isMainScreen);
    const regularPlayers = this.currentRoom.players.filter(p => !p.isMainScreen);
    
    // Show main screen if exists
    if (mainScreenPlayer) {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-item main-screen-player';
      playerDiv.innerHTML = `
        <span class="player-name">📺 ${mainScreenPlayer.name}</span>
        <span class="player-role">Main Screen</span>
        ${mainScreenPlayer.isHost ? '<span class="host-badge">Host</span>' : ''}
      `;
      playerList.appendChild(playerDiv);
    }
    
    // Show regular players
    regularPlayers.forEach((player, index) => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-item';
      playerDiv.innerHTML = `
        <span class="player-name">📱 ${player.name}</span>
        <span class="player-role">Player ${index + 1}</span>
        ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
      `;
      playerList.appendChild(playerDiv);
    });
    
    this.updateConnectionInfo();
  }

  startPartyGame() {
    console.log('Starting party game...');
    const viewTimeSelect = document.getElementById('party-view-time');
    const drawTimeSelect = document.getElementById('party-draw-time');
    const difficultySelect = document.getElementById('party-difficulty');
    
    const viewTime = viewTimeSelect ? parseInt(viewTimeSelect.value) : 20;
    const drawTime = drawTimeSelect ? parseInt(drawTimeSelect.value) : 120;
    const difficulty = difficultySelect ? difficultySelect.value : 'standard';
    
    console.log('Game settings:', { viewTime, drawTime, difficulty });
    
    if (!this.socket || !this.isConnected) {
      this.showError('Not connected to server');
      return;
    }
    
    this.socket.emit('start-game', { viewTime, drawTime, difficulty });
  }

  handleGamePhase(gameState, extraData = {}) {
    console.log('Handling game phase:', gameState.phase);
    
    // Hide lobby, show game area
    const partyLobby = document.getElementById('party-lobby');
    const partyGameArea = document.getElementById('party-game-area');
    
    if (partyLobby) partyLobby.classList.add('hidden');
    if (partyGameArea) partyGameArea.classList.remove('hidden');
    
    // Update status
    this.updateGameStatus(gameState);
    
    // Handle different phases
    switch (gameState.phase) {
      case 'studying':
        this.handleStudyingPhase(gameState);
        break;
      case 'drawing':
        this.handleDrawingPhase(gameState);
        break;
      case 'reveal':
        this.handleRevealPhase(gameState, extraData);
        break;
    }
  }

  handleStudyingPhase(gameState) {
    console.log('Handling studying phase');
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    
    if (this.isMainScreen) {
      this.showMainScreenStudying(currentPlayer, gameState);
    } else if (isMyTurn) {
      // Monster will be sent separately via 'monster-revealed' event
      this.showWaitingArea('Get Ready!', 'You will see the monster in a moment...');
    } else {
      this.showWaitingArea('Studying Phase', `${currentPlayer ? currentPlayer.name : 'Someone'} is studying the monster...`);
    }
  }

  handleDrawingPhase(gameState) {
    console.log('Handling drawing phase');
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    
    if (this.isMainScreen) {
      this.showMainScreenDrawing(currentPlayer, gameState);
    } else if (isMyTurn) {
      this.showWaitingArea('Your Turn!', 'Describe the monster to the other players so they can draw it!');
    } else {
      this.showDrawingArea();
    }
  }

  handleRevealPhase(gameState, extraData) {
    console.log('Handling reveal phase', extraData);
    
    if (this.isMainScreen) {
      this.showMainScreenReveal(gameState, extraData);
    } else {
      this.showWaitingArea('Round Complete!', 'Check the main screen to see all the drawings!');
    }
  }

  showMonsterToDrawer(monster, viewTime) {
    console.log('Showing monster to drawer:', monster);
    
    const monsterView = document.getElementById('monster-view');
    const monsterImage = document.getElementById('party-monster-image');
    const playerView = document.getElementById('player-view');
    const mainScreenView = document.getElementById('main-screen-view');
    
    if (playerView) playerView.classList.remove('hidden');
    if (mainScreenView) mainScreenView.classList.add('hidden');
    if (monsterView) monsterView.classList.remove('hidden');
    if (monsterImage) {
      monsterImage.src = `images/${monster}`;
      monsterImage.alt = monster;
    }
    
    // Hide other areas
    const drawingArea = document.getElementById('drawing-area');
    const waitingArea = document.getElementById('waiting-area');
    if (drawingArea) drawingArea.classList.add('hidden');
    if (waitingArea) waitingArea.classList.add('hidden');
  }

  showDrawingArea() {
    console.log('Showing drawing area');
    
    const playerView = document.getElementById('player-view');
    const drawingArea = document.getElementById('drawing-area');
    const monsterView = document.getElementById('monster-view');
    const waitingArea = document.getElementById('waiting-area');
    const mainScreenView = document.getElementById('main-screen-view');
    
    if (playerView) playerView.classList.remove('hidden');
    if (mainScreenView) mainScreenView.classList.add('hidden');
    if (drawingArea) drawingArea.classList.remove('hidden');
    if (monsterView) monsterView.classList.add('hidden');
    if (waitingArea) waitingArea.classList.add('hidden');
    
    // Setup canvas if not already done
    this.setupDrawingCanvas();
  }

  showWaitingArea(title, message) {
    console.log('Showing waiting area:', title);
    
    const playerView = document.getElementById('player-view');
    const waitingArea = document.getElementById('waiting-area');
    const waitingTitle = document.getElementById('waiting-title');
    const waitingMessage = document.getElementById('waiting-message');
    const drawingArea = document.getElementById('drawing-area');
    const monsterView = document.getElementById('monster-view');
    const mainScreenView = document.getElementById('main-screen-view');
    
    if (playerView) playerView.classList.remove('hidden');
    if (mainScreenView) mainScreenView.classList.add('hidden');
    if (waitingArea) waitingArea.classList.remove('hidden');
    if (drawingArea) drawingArea.classList.add('hidden');
    if (monsterView) monsterView.classList.add('hidden');
    
    if (waitingTitle) waitingTitle.textContent = title;
    if (waitingMessage) waitingMessage.textContent = message;
  }

  showMainScreenStudying(currentPlayer, gameState) {
    console.log('Showing main screen studying phase');
    
    const mainScreenView = document.getElementById('main-screen-view');
    const playerView = document.getElementById('player-view');
    const mainGameInfo = document.getElementById('main-game-info');
    const mainDrawingsDisplay = document.getElementById('main-drawings-display');
    
    if (mainScreenView) mainScreenView.classList.remove('hidden');
    if (playerView) playerView.classList.add('hidden');
    if (mainDrawingsDisplay) mainDrawingsDisplay.classList.add('hidden');
    
    if (mainGameInfo) {
      mainGameInfo.innerHTML = `
        <div class="main-screen-phase">
          <h2>Round ${gameState.currentRound} - Studying Phase</h2>
          <div class="current-drawer">
            <h3>Current Drawer: ${currentPlayer ? currentPlayer.name : 'Unknown'}</h3>
            <p>They are memorizing the monster...</p>
          </div>
          <div class="phase-instructions">
            <p>📱 Players, get ready to draw!</p>
            <p>🎨 The drawer will describe what they saw</p>
          </div>
        </div>
      `;
    }
  }

  showMainScreenDrawing(currentPlayer, gameState) {
    console.log('Showing main screen drawing phase');
    
    const mainScreenView = document.getElementById('main-screen-view');
    const playerView = document.getElementById('player-view');
    const mainGameInfo = document.getElementById('main-game-info');
    const mainDrawingsDisplay = document.getElementById('main-drawings-display');
    
    if (mainScreenView) mainScreenView.classList.remove('hidden');
    if (playerView) playerView.classList.add('hidden');
    if (mainDrawingsDisplay) mainDrawingsDisplay.classList.add('hidden');
    
    if (mainGameInfo) {
      mainGameInfo.innerHTML = `
        <div class="main-screen-phase">
          <h2>Round ${gameState.currentRound} - Drawing Phase</h2>
          <div class="current-drawer">
            <h3>Drawer: ${currentPlayer ? currentPlayer.name : 'Unknown'}</h3>
            <p>🗣️ Now describing the monster</p>
          </div>
          <div class="phase-instructions">
            <p>📱 Other players are drawing on their phones</p>
            <p>🎨 Listen carefully and draw what you hear!</p>
          </div>
          <div id="drawing-progress" class="drawing-progress">
            <p>Drawings submitted: <span id="progress-count">0</span> / <span id="progress-total">0</span></p>
          </div>
        </div>
      `;
    }
  }

  showMainScreenReveal(gameState, extraData) {
    console.log('Showing main screen reveal phase');
    
    const mainScreenView = document.getElementById('main-screen-view');
    const playerView = document.getElementById('player-view');
    const mainGameInfo = document.getElementById('main-game-info');
    const mainDrawingsDisplay = document.getElementById('main-drawings-display');
    
    if (mainScreenView) mainScreenView.classList.remove('hidden');
    if (playerView) playerView.classList.add('hidden');
    if (mainDrawingsDisplay) mainDrawingsDisplay.classList.remove('hidden');
    
    if (mainGameInfo) {
      mainGameInfo.innerHTML = `
        <div class="main-screen-phase">
          <h2>Round ${gameState.currentRound} - Results!</h2>
          <div class="reveal-header">
            <h3>How did everyone do?</h3>
            <p>Original monster vs. player drawings</p>
          </div>
        </div>
      `;
    }
    
    // Show drawings
    this.displayAllDrawings(extraData.allDrawings || [], extraData.originalMonster);
    
    // Show next round button for host
    if (this.isHost && this.isMainScreen) {
      this.showNextRoundButton(gameState);
    }
  }

  displayAllDrawings(drawings, originalMonster) {
    const mainDrawingsDisplay = document.getElementById('main-drawings-display');
    if (!mainDrawingsDisplay) return;
    
    mainDrawingsDisplay.innerHTML = `
      <div class="drawings-gallery">
        <div class="original-monster">
          <h4>Original Monster</h4>
          <img src="images/${originalMonster}" alt="Original Monster" class="drawing-image">
        </div>
        ${drawings.map(drawing => `
          <div class="player-drawing">
            <h4>${drawing.playerName}</h4>
            <img src="${drawing.imageData}" alt="${drawing.playerName}'s drawing" class="drawing-image">
          </div>
        `).join('')}
      </div>
    `;
  }

  showNextRoundButton(gameState) {
    const mainGameInfo = document.getElementById('main-game-info');
    if (!mainGameInfo) return;
    
    const isLastRound = gameState.currentRound >= gameState.maxRounds;
    
    const buttonHtml = `
      <div class="host-controls-active">
        <button id="next-round-host-btn" class="party-btn ${isLastRound ? 'finish-btn' : 'next-btn'}">
          ${isLastRound ? 'Finish Game' : 'Next Round'}
        </button>
      </div>
    `;
    
    mainGameInfo.innerHTML += buttonHtml;
    
    const nextRoundBtn = document.getElementById('next-round-host-btn');
    if (nextRoundBtn) {
      nextRoundBtn.addEventListener('click', () => {
        this.socket.emit('next-round');
      });
    }
  }

  updateGameStatus(gameState) {
    const partyStatus = document.getElementById('party-status');
    if (!partyStatus) return;
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    
    let statusText = '';
    switch (gameState.phase) {
      case 'studying':
        statusText = `Round ${gameState.currentRound} - ${currentPlayer ? currentPlayer.name : 'Someone'} is studying the monster`;
        break;
      case 'drawing':
        statusText = `Round ${gameState.currentRound} - Drawing phase! ${isMyTurn ? "It's your turn to describe!" : 'Draw what you hear!'}`;
        break;
      case 'reveal':
        statusText = `Round ${gameState.currentRound} - Results time!`;
        break;
    }
    
    partyStatus.innerHTML = `
      <h3>${statusText}</h3>
      ${gameState.phase === 'drawing' && !this.isMainScreen && !isMyTurn ? '<p>Listen to the drawer and create your masterpiece!</p>' : ''}
    `;
  }

  updateGameTimer(timeLeft, phase) {
    const partyTimer = document.getElementById('party-timer');
    if (!partyTimer) return;
    
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    partyTimer.textContent = timeString;
    partyTimer.classList.remove('hidden');
    
    // Add warning class for last 10 seconds
    if (timeLeft <= 10) {
      partyTimer.classList.add('timer-warning');
    } else {
      partyTimer.classList.remove('timer-warning');
    }
  }

  updateDrawingProgress(data) {
    const progressCount = document.getElementById('progress-count');
    const progressTotal = document.getElementById('progress-total');
    
    if (progressCount) progressCount.textContent = data.totalSubmitted;
    if (progressTotal) progressTotal.textContent = data.totalExpected;
    
    if (!this.isMainScreen) {
      this.showMessage(`${data.playerName} finished drawing! (${data.totalSubmitted}/${data.totalExpected})`);
    }
  }

  setupDrawingCanvas() {
    const canvas = document.getElementById('party-canvas');
    if (!canvas || this.canvas) return; // Already setup
    
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Set canvas style
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = '#000000';
    
    // Touch/mouse events for drawing
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    
    const startDrawing = (e) => {
      isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      lastX = clientX - rect.left;
      lastY = clientY - rect.top;
    };
    
    const draw = (e) => {
      if (!isDrawing) return;
      
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      
      const currentX = clientX - rect.left;
      const currentY = clientY - rect.top;
      
      this.ctx.beginPath();
      this.ctx.moveTo(lastX, lastY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
      
      lastX = currentX;
      lastY = currentY;
    };
    
    const stopDrawing = () => {
      isDrawing = false;
    };
    
    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Color and brush size controls
    const colorPicker = document.getElementById('brush-color');
    const brushSize = document.getElementById('brush-size');
    
    if (colorPicker) {
      colorPicker.addEventListener('change', (e) => {
        this.ctx.strokeStyle = e.target.value;
      });
    }
    
    if (brushSize) {
      brushSize.addEventListener('input', (e) => {
        this.ctx.lineWidth = e.target.value;
      });
    }
  }

  clearCanvas() {
    if (!this.canvas || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  submitDrawing() {
    if (!this.canvas || !this.socket) return;
    
    const imageData = this.canvas.toDataURL('image/png');
    this.socket.emit('submit-drawing', { imageData });
    
    // Disable submit button
    const submitBtn = document.getElementById('submit-drawing');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitted!';
      submitBtn.style.background = '#4CAF50';
    }
    
    this.showMessage('Drawing submitted successfully!');
  }

  handleGameFinished(data) {
    console.log('Game finished:', data);
    
    if (this.isMainScreen) {
      const mainGameInfo = document.getElementById('main-game-info');
      if (mainGameInfo) {
        mainGameInfo.innerHTML = `
          <div class="main-screen-phase">
            <h2>🎉 Game Complete!</h2>
            <p>Thanks for playing Drawblins!</p>
            <div class="host-controls-active">
              <button id="new-game-btn" class="party-btn create-btn">Start New Game</button>
              <button id="back-to-lobby-btn" class="party-btn back-btn">Back to Lobby</button>
            </div>
          </div>
        `;
        
        const newGameBtn = document.getElementById('new-game-btn');
        const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
        
        if (newGameBtn) {
          newGameBtn.addEventListener('click', () => {
            this.showLobby();
          });
        }
        
        if (backToLobbyBtn) {
          backToLobbyBtn.addEventListener('click', () => {
            this.showLobby();
          });
        }
      }
    } else {
      this.showWaitingArea('Game Complete!', '🎉 Thanks for playing! Check the main screen for final results.');
    }
  }

  updateConnectionStatus(status) {
    console.log('Connection status:', status);
    const statusElement = document.getElementById('party-connection-status');
    if (!statusElement) return;
    
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('.status-text');
    
    if (text) text.textContent = status;
    
    if (indicator) {
      if (status === 'Connected') {
        indicator.className = 'status-indicator connected';
      } else {
        indicator.className = 'status-indicator disconnected';
      }
    }
  }

  showError(message) {
    console.error('Error:', message);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'party-toast error-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  showMessage(message) {
    console.log('Message:', message);
    
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'party-toast success-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  cleanup() {
    console.log('Cleaning up party mode...');
    
    // Clear timers
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    
    // Disconnect socket
    if (this.socket && this.isConnected) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    
    // Reset state
    this.playerName = '';
    this.roomCode = '';
    this.isHost = false;
    this.isMainScreen = false;
    this.currentRoom = null;
    this.canvas = null;
    this.ctx = null;
    
    // Reset UI
    this.updateConnectionStatus('Not Connected');
    
    // Re-enable submit button if it was disabled
    const submitBtn = document.getElementById('submit-drawing');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Drawing';
      submitBtn.style.background = '';
    }
  }
}

// Initialize party mode when DOM is loaded
let partyClient = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing enhanced party client...');
  if (window.self === window.top) {
    partyClient = new PartyGameClient();
    partyClient.init();
    console.log('✅ Enhanced party client initialized');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (partyClient) {
    partyClient.cleanup();
  }
});