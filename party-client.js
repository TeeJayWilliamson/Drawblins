// Enhanced Party Mode Client - Custom Cast Integration
class PartyGameClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerName = '';
    this.roomCode = '';
    this.isHost = false;
    this.currentRoom = null;
    this.gameTimer = null;
    this.serverUrl = 'https://drawblins-production.up.railway.app';
    this.audioInitialized = false;
    this.currentMusicPhase = null;
    this.castManager = null;
  }

  // Initialize party mode
  init() {
    console.log('Initializing Enhanced Party Mode...');
    this.createPartyModeUI();
    this.setupAudio();
    this.initializeCastSDK();
  }

  // Setup audio system
  setupAudio() {
    const waitingMusic = document.getElementById('waiting-music');
    const drawingMusic = document.getElementById('drawing-music');
    const buzzer = document.getElementById('buzzer');
    
    this.waitingMusic = waitingMusic;
    this.drawingMusic = drawingMusic;
    this.buzzer = buzzer;
  }

  // Initialize Google Cast SDK with custom receiver
  initializeCastSDK() {
    this.castManager = new CustomCastManager(this);
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
      console.log('Connected to party server');
      this.isConnected = true;
      this.updateConnectionStatus('Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from party server');
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
        this.showLobby();
        console.log('Room created successfully:', data.roomCode);
      } else {
        console.error('Room creation failed:', data.error);
        this.showError(data.error);
      }
    });

    this.socket.on('room-joined', (data) => {
      console.log('Room joined response:', data);
      if (data.success) {
        this.currentRoom = data.room;
        this.showLobby();
        console.log('Joined room successfully');
      } else {
        console.error('Failed to join room:', data.error);
        this.showError(data.error);
      }
    });

    this.socket.on('player-joined', (data) => {
      console.log('Player joined:', data);
      this.currentRoom = data.room;
      this.updatePlayerList();
      this.showMessage(`${data.player.name} joined the game!`);
    });

    this.socket.on('player-left', (data) => {
      console.log('Player left:', data);
      this.currentRoom = data.room;
      this.updatePlayerList();
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

    this.socket.on('auto-submit-drawing', (data) => {
      console.log('Auto-submit requested');
      this.handleAutoSubmit();
    });

    this.socket.on('game-finished', (data) => {
      console.log('Game finished:', data);
      this.handleGameFinished(data);
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

  // Audio functions
  initializeAudio() {
    if (this.audioInitialized) return;
    
    const audioElements = [this.buzzer, this.waitingMusic, this.drawingMusic].filter(el => el);
    
    audioElements.forEach(audio => {
      if (audio) {
        audio.play().then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0;
        }).catch(() => {});
      }
    });
    
    this.audioInitialized = true;
  }

  playMusic(phase) {
    if (!this.audioInitialized) return;
    if (!window.gameAudio?.shouldPlaySound?.()) return;

    this.currentMusicPhase = phase;
    
    if (phase === 'drawing' && this.drawingMusic) {
      if (this.waitingMusic && !this.waitingMusic.paused) {
        this.crossfadeAudio(this.waitingMusic, this.drawingMusic, 1500);
      } else {
        this.fadeInAudio(this.drawingMusic, 2000);
      }
    } else if (phase === 'waiting' && this.waitingMusic) {
      this.stopAllMusicImmediate();
      this.fadeInAudio(this.waitingMusic, 2000);
    }
  }

  fadeInAudio(audio, duration = 2000) {
    if (!audio || !window.gameAudio?.shouldPlaySound?.()) return;
    
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
    
    audio.play().catch(() => {});
    
    const targetVolume = window.gameVolume || 0.6;
    const steps = 40;
    const stepSize = targetVolume / steps;
    const stepInterval = duration / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      if (audio.paused) {
        clearInterval(interval);
        return;
      }
      
      currentStep++;
      audio.volume = Math.min(targetVolume, currentStep * stepSize);
      
      if (currentStep >= steps) {
        clearInterval(interval);
        audio.volume = targetVolume;
      }
    }, stepInterval);
  }

  crossfadeAudio(fadeOutAudio, fadeInAudio, duration = 1500) {
    if (!fadeOutAudio || !fadeInAudio) return;
    
    fadeInAudio.pause();
    fadeInAudio.currentTime = 0;
    fadeInAudio.volume = 0;
    
    if (window.gameAudio?.shouldPlaySound?.()) {
      fadeInAudio.play().catch(() => {});
    }
    
    const targetVolume = window.gameVolume || 0.6;
    const steps = 30;
    const stepInterval = duration / steps;
    const fadeOutStart = fadeOutAudio.volume;
    const fadeOutStep = fadeOutStart / steps;
    const fadeInStep = targetVolume / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      
      if (!fadeOutAudio.paused) {
        fadeOutAudio.volume = Math.max(0, fadeOutStart - (currentStep * fadeOutStep));
      }
      
      if (!fadeInAudio.paused && window.gameAudio?.shouldPlaySound?.()) {
        fadeInAudio.volume = Math.min(targetVolume, currentStep * fadeInStep);
      }
      
      if (currentStep >= steps) {
        clearInterval(interval);
        
        fadeOutAudio.pause();
        fadeOutAudio.currentTime = 0;
        fadeOutAudio.volume = 0;
        
        if (window.gameAudio?.shouldPlaySound?.()) {
          fadeInAudio.volume = targetVolume;
        } else {
          fadeInAudio.pause();
          fadeInAudio.volume = 0;
        }
      }
    }, stepInterval);
  }

  stopAllMusicImmediate() {
    if (this.waitingMusic) {
      this.waitingMusic.pause();
      this.waitingMusic.currentTime = 0;
      this.waitingMusic.volume = 0;  
    }
    if (this.drawingMusic) {
      this.drawingMusic.pause();
      this.drawingMusic.currentTime = 0;
      this.drawingMusic.volume = 0;
    }
  }

  playBuzzer() {
    if (!window.gameAudio?.shouldPlaySound?.() || !this.buzzer) return;
    
    this.buzzer.currentTime = 0;
    this.buzzer.volume = window.gameVolume || 0.6;
    this.buzzer.play().catch(() => {});
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
        <h3>Party Mode</h3>
        <p>Play together - everyone uses their own device!</p>
        
        <div id="party-connection-status" class="connection-status">
          <span class="status-indicator"></span>
          <span class="status-text">Not Connected</span>
        </div>
        
        <!-- Setup Form -->
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
        
        <!-- Lobby -->
        <div id="party-lobby" class="party-lobby hidden">
          <div class="room-info">
            <h4>Room: <span id="room-code-display"></span></h4>
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
            <div class="host-action-buttons">
              <button id="start-party-game-btn" class="party-btn start-btn">Start Game</button>
              <button id="cast-to-tv-btn" class="party-btn cast-btn">
                📺 Cast to TV
              </button>
            </div>
          </div>
        </div>
        
        <!-- Game Area -->
        <div id="party-game-area" class="party-game-area hidden">
          <!-- Simple game status -->
          <div id="party-status" class="party-status"></div>
          
          <!-- Monster viewing (for current drawer only) -->
          <div id="monster-view" class="monster-view hidden">
            <div class="monster-study-interface">
              <div class="study-timer">00:00</div>
              <h3>Study This Monster!</h3>
              <img id="party-monster-image" src="" alt="Monster to draw">
              <p>Memorize it - you'll need to describe it to others!</p>
            </div>
          </div>
          
          <!-- Waiting area -->
          <div id="waiting-area" class="waiting-area hidden">
            <h3 id="waiting-title">Waiting...</h3>
            <p id="waiting-message">Please wait for the game to continue.</p>
            <div id="waiting-timer" class="waiting-timer hidden">00:00</div>
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
    console.log('Enhanced Party Mode UI created');
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

    // Cast button
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      castBtn.addEventListener('click', () => {
        console.log('Cast button clicked');
        this.handleCastClick();
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

    // Allow Enter key for joining rooms
    const joinRoomCodeInput = document.getElementById('join-room-code');
    if (joinRoomCodeInput) {
      joinRoomCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.joinRoom();
        }
      });
    }

    const playerNameInput = document.getElementById('player-name-input');
    if (playerNameInput) {
      playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.createRoom();
        }
      });
    }

    console.log('Event listeners set up');
  }

  // Handle cast button click
  handleCastClick() {
    if (this.castManager) {
      this.castManager.handleCastClick();
    }
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
    if (partySection) {
      partySection.classList.remove('hidden');
      partySection.style.display = 'block';
      partySection.style.visibility = 'visible';
    }
    if (settingsGroup) settingsGroup.classList.add('hidden');
    if (startButtons) startButtons.classList.add('hidden');
    
    // Show setup form
    this.showSetupForm();
  }

  showSetupForm() {
    const partySetup = document.getElementById('party-setup');
    const partyLobby = document.getElementById('party-lobby');
    const partyGameArea = document.getElementById('party-game-area');
    
    if (partySetup) {
      partySetup.classList.remove('hidden');
      partySetup.style.display = 'block';
      partySetup.style.visibility = 'visible';
    }
    if (partyLobby) partyLobby.classList.add('hidden');
    if (partyGameArea) partyGameArea.classList.add('hidden');
  }

  createRoom() {
    console.log('Creating room...');
    const playerNameInput = document.getElementById('player-name-input');
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    
    console.log('Player name:', playerName);
    
    if (!playerName) {
      console.error('No player name entered');
      this.showError('Please enter your name');
      return;
    }

    if (!this.socket || !this.isConnected) {
      console.error('Not connected to server');
      this.showError('Not connected to server. Please try again.');
      return;
    }

    this.playerName = playerName;
    console.log('Emitting create-room event...');
    this.socket.emit('create-room', { 
      playerName: playerName
    });
  }

  joinRoom() {
    console.log('Joining room...');
    const playerNameInput = document.getElementById('player-name-input');
    const roomCodeInput = document.getElementById('join-room-code');
    
    const playerName = playerNameInput ? playerNameInput.value.trim() : '';
    const roomCode = roomCodeInput ? roomCodeInput.value.trim().toUpperCase() : '';
    
    console.log('Player name:', playerName, 'Room code:', roomCode);
    
    if (!playerName) {
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

    this.playerName = playerName;
    console.log('Emitting join-room event...');
    this.socket.emit('join-room', { 
      roomCode, 
      playerName: playerName
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
    
    this.updatePlayerList();
    console.log('Lobby shown');
  }

  updatePlayerList() {
    const playerList = document.getElementById('player-list');
    if (!playerList || !this.currentRoom) return;
    
    playerList.innerHTML = '';
    
    this.currentRoom.players.forEach((player, index) => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player-item';
      playerDiv.innerHTML = `
        <span class="player-name">${player.name}</span>
        <span class="player-role">Player ${index + 1}</span>
        ${player.isHost ? '<span class="host-badge">Host</span>' : ''}
      `;
      playerList.appendChild(playerDiv);
    });
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
    console.log('Handling game phase:', gameState.phase, 'Current drawer:', gameState.currentDrawer, 'My socket ID:', this.socket.id);
    this.initializeAudio();
    
    // Hide lobby, show game area
    const partyLobby = document.getElementById('party-lobby');
    const partyGameArea = document.getElementById('party-game-area');
    
    if (partyLobby) partyLobby.classList.add('hidden');
    if (partyGameArea) partyGameArea.classList.remove('hidden');
    
    // Send update to cast display
    this.sendToCastDisplay('game-update', {
      gameState: gameState,
      room: this.currentRoom
    });
    
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
    console.log('Handling studying phase - Am I the drawer?', this.socket.id === gameState.currentDrawer);
    this.playMusic('waiting');
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    
    if (isMyTurn) {
      this.showWaitingArea('Get Ready!', 'You will see the monster in a moment...');
    } else {
      this.showWaitingArea('Study Phase', `${currentPlayer ? currentPlayer.name : 'Someone'} is studying the monster. Get ready to draw!`);
    }
  }

  handleDrawingPhase(gameState) {
    console.log('Handling drawing phase - Am I the drawer?', this.socket.id === gameState.currentDrawer);
    this.playMusic('drawing');
    
    const currentPlayer = this.currentRoom.players.find(p => p.id === gameState.currentDrawer);
    const isMyTurn = this.socket.id === gameState.currentDrawer;
    
    if (isMyTurn) {
      this.showWaitingArea('Your Turn to Describe!', 'Describe the monster you saw to help others draw it!');
    } else {
      this.showMinimalDrawing();
    }
  }

  handleRevealPhase(gameState, extraData) {
    console.log('🎭 === REVEAL PHASE DEBUG ===');
    console.log('gameState:', gameState);
    console.log('extraData:', extraData);
    console.log('extraData.allDrawings:', extraData.allDrawings);
    console.log('extraData.originalMonster:', extraData.originalMonster);
    console.log('gameState.drawings:', gameState.drawings);
    console.log('gameState.currentMonster:', gameState.currentMonster);
    
    this.stopAllMusicImmediate();
    
    // Try multiple sources for drawings data
    let drawings = extraData.allDrawings || extraData.drawings || gameState.drawings || [];
    let originalMonster = extraData.originalMonster || gameState.currentMonster;
    
    console.log('📸 Final data to send:');
    console.log('- drawings:', drawings);
    console.log('- drawings length:', drawings?.length || 0);
    console.log('- originalMonster:', originalMonster);
    
    // Send a lightweight game update first (without drawings to avoid size limit)
    this.sendToCastDisplay('game-update', {
      gameState: {
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        currentDrawer: gameState.currentDrawer,
        currentDrawerIndex: gameState.currentDrawerIndex
        // Exclude drawings and other large data
      },
      room: {
        code: this.currentRoom.code,
        players: this.currentRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost
        }))
        // Exclude gameState from room to avoid duplication
      }
    });
    
    // Then send drawings separately using the compression system
    console.log('📤 About to call sendToCastDisplay for drawings...');
    this.sendToCastDisplay('show-drawings', {
      drawings: drawings,
      originalMonster: originalMonster
    });
    
    this.showWaitingArea('Round Complete!', 'Check the cast screen to see all the drawings!');
    
    // Show next round button for host
    if (this.isHost) {
      this.showNextRoundButton(gameState);
    }
  }

  // Also add this method if it doesn't exist or update it:
  sendToCastDisplay(type, data) {
    console.log('🎬 === SEND TO CAST DISPLAY ===');
    console.log('Type:', type);
    console.log('Data:', data);
    console.log('Cast manager exists:', !!this.castManager);
    
    if (this.castManager) {
      console.log('📡 Calling castManager.sendToCast...');
      this.castManager.sendToCast(type, data);
    } else {
      console.log('❌ No cast manager available');
    }
  }

  showMonsterToDrawer(monster, viewTime) {
    console.log('Showing monster to drawer:', monster);
    
    const monsterView = document.getElementById('monster-view');
    const monsterImage = document.getElementById('party-monster-image');
    
    if (monsterView) monsterView.classList.remove('hidden');
    if (monsterImage) {
      monsterImage.src = `images/${monster}`;
      monsterImage.alt = monster;
    }
    
    // Hide other areas
    this.hideAllPlayerViews();
    if (monsterView) monsterView.classList.remove('hidden');
  }

  showMinimalDrawing() {
    console.log('Showing minimal drawing interface');
    
    // Hide all other views
    this.hideAllPlayerViews();
    
    // Create or show the drawing overlay
    this.createDrawingOverlay();
  }

  createDrawingOverlay() {
    // Remove existing drawing overlay if any
    const existingOverlay = document.getElementById('drawing-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
    
    // Create new drawing overlay iframe
    const overlay = document.createElement('div');
    overlay.id = 'drawing-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      z-index: 5000;
      background: white;
    `;
    
    const iframe = document.createElement('iframe');
    iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Drawing Interface</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            overflow: hidden;
            height: 100vh;
            width: 100vw;
            position: fixed;
            top: 0;
            left: 0;
          }
          
          .drawing-interface {
            display: flex;
            flex-direction: column;
            height: 100vh;
            width: 100vw;
          }
          
          .drawing-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 2rem;
            backdrop-filter: blur(10px);
            color: white;
            flex-shrink: 0;
            min-height: 80px;
          }
          
          .drawing-title {
            font-size: 1.5rem;
            font-weight: bold;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
          }
          
          .drawing-timer {
            background: rgba(0, 0, 0, 0.6);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 25px;
            font-size: 1.5rem;
            font-weight: bold;
            min-width: 120px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          }
          
          .drawing-timer.timer-urgent {
            background: #e74c3c;
          }
          
          .canvas-container {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(5px);
          }
          
          #drawing-canvas {
            border: 4px solid white;
            border-radius: 20px;
            background: white;
            cursor: crosshair;
            touch-action: none;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            display: block;
          }
          
          .drawing-controls {
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            padding: 1.5rem;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            min-height: 120px;
            position: sticky;
            bottom: 0;
            width: 100%;
          }
          
          .color-size-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .action-controls {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          #brush-color {
            width: 50px;
            height: 50px;
            border: 3px solid white;
            border-radius: 15px;
            cursor: pointer;
            background: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }
          
          #brush-size {
            width: 120px;
            height: 8px;
            -webkit-appearance: none;
            background: rgba(255,255,255,0.3);
            border-radius: 5px;
            outline: none;
          }
          
          #brush-size::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          }
          
          #brush-preview {
            background: #000;
            border: 2px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          
          .control-btn {
            background: white;
            color: #333;
            border: none;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            cursor: pointer;
            font-size: 1.2rem;
            font-weight: bold;
            transition: all 0.3s ease;
            min-width: 140px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            text-align: center;
          }
          
          .control-btn:hover:not(:disabled) {
            background: #f0f0f0;
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.4);
          }
          
          .control-btn:disabled {
            background: #cccccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          
          .control-btn.submit-btn {
            background: #27ae60;
            color: white;
            font-size: 1.3rem;
            min-width: 160px;
            padding: 1.2rem 2rem;
          }
          
          .control-btn.submit-btn:hover:not(:disabled) {
            background: #229954;
            box-shadow: 0 8px 30px rgba(39, 174, 96, 0.4);
          }
          
          .control-btn.submit-btn.submitted {
            background: #1e8449;
          }
          
          .control-btn.clear-btn {
            background: #e74c3c;
            color: white;
          }
          
          .control-btn.clear-btn:hover {
            background: #c0392b;
          }
        </style>
      </head>
      <body>
        <div class="drawing-interface">
          <div class="drawing-header">
            <div class="drawing-title">Draw What You Hear!</div>
            <div class="drawing-timer" id="drawing-timer">02:00</div>
          </div>
          
          <div class="canvas-container">
            <canvas id="drawing-canvas" width="600" height="600"></canvas>
          </div>
          
          <div class="drawing-controls">
            <div class="color-size-controls">
              <input type="color" id="brush-color" value="#000000">
              <input type="range" id="brush-size" min="1" max="30" value="5">
              <div id="brush-preview"></div>
            </div>
            
            <div class="action-controls">
              <button id="clear-btn" class="control-btn clear-btn">Clear</button>
              <button id="submit-btn" class="control-btn submit-btn">Submit</button>
            </div>
          </div>
        </div>
        
        <script>
          class DrawingInterface {
            constructor() {
              this.canvas = document.getElementById('drawing-canvas');
              this.ctx = this.canvas.getContext('2d');
              this.isDrawing = false;
              this.lastX = 0;
              this.lastY = 0;
              
              this.init();
            }
            
            init() {
              this.setupCanvas();
              this.setupEventListeners();
              this.updateBrushPreview();
            }
            
            setupCanvas() {
              this.resizeCanvas();
              
              this.ctx.lineCap = 'round';
              this.ctx.lineJoin = 'round';
              this.ctx.lineWidth = 5;
              this.ctx.strokeStyle = '#000000';
            }
            
            resizeCanvas() {
              const container = this.canvas.parentElement;
              const containerRect = container.getBoundingClientRect();
              
              const maxSize = Math.min(containerRect.width - 40, containerRect.height - 40, 600);
              
              this.canvas.style.width = maxSize + 'px';
              this.canvas.style.height = maxSize + 'px';
              
              const dpr = window.devicePixelRatio || 1;
              this.canvas.width = maxSize * dpr;
              this.canvas.height = maxSize * dpr;
              
              this.ctx.scale(dpr, dpr);
              
              this.ctx.lineCap = 'round';
              this.ctx.lineJoin = 'round';
              this.ctx.lineWidth = document.getElementById('brush-size').value;
              this.ctx.strokeStyle = document.getElementById('brush-color').value;
            }
            
            setupEventListeners() {
              this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
              this.canvas.addEventListener('mousemove', (e) => this.draw(e));
              this.canvas.addEventListener('mouseup', () => this.stopDrawing());
              this.canvas.addEventListener('mouseout', () => this.stopDrawing());
              
              this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e));
              this.canvas.addEventListener('touchmove', (e) => this.draw(e));
              this.canvas.addEventListener('touchend', () => this.stopDrawing());
              
              document.getElementById('brush-color').addEventListener('change', (e) => {
                this.ctx.strokeStyle = e.target.value;
                this.updateBrushPreview();
              });
              
              document.getElementById('brush-size').addEventListener('input', (e) => {
                this.ctx.lineWidth = e.target.value;
                this.updateBrushPreview();
              });
              
              document.getElementById('clear-btn').addEventListener('click', () => {
                this.clearCanvas();
              });
              
              document.getElementById('submit-btn').addEventListener('click', () => {
                this.submitDrawing();
              });
              
              window.addEventListener('resize', () => {
                this.resizeCanvas();
              });
            }
            
            getCoordinates(e) {
              const rect = this.canvas.getBoundingClientRect();
              const clientX = e.clientX || (e.touches && e.touches[0].clientX);
              const clientY = e.clientY || (e.touches && e.touches[0].clientY);
              
              const scaleX = this.canvas.width / rect.width;
              const scaleY = this.canvas.height / rect.height;
              
              const x = (clientX - rect.left) * scaleX / (window.devicePixelRatio || 1);
              const y = (clientY - rect.top) * scaleY / (window.devicePixelRatio || 1);
              
              return { x, y };
            }
            
            startDrawing(e) {
              e.preventDefault();
              this.isDrawing = true;
              const coords = this.getCoordinates(e);
              this.lastX = coords.x;
              this.lastY = coords.y;
            }
            
            draw(e) {
              if (!this.isDrawing) return;
              
              e.preventDefault();
              const coords = this.getCoordinates(e);
              
              this.ctx.beginPath();
              this.ctx.moveTo(this.lastX, this.lastY);
              this.ctx.lineTo(coords.x, coords.y);
              this.ctx.stroke();
              
              this.lastX = coords.x;
              this.lastY = coords.y;
            }
            
            stopDrawing() {
              this.isDrawing = false;
            }
            
            clearCanvas() {
              this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
            
            submitDrawing() {
              const imageData = this.canvas.toDataURL('image/png');
              
              const submitBtn = document.getElementById('submit-btn');
              submitBtn.disabled = true;
              submitBtn.textContent = 'Submitted!';
              submitBtn.classList.add('submitted');
              
              window.parent.postMessage({
                type: 'drawing-submitted',
                imageData: imageData
              }, '*');
            }
            
            updateBrushPreview() {
              const preview = document.getElementById('brush-preview');
              const color = document.getElementById('brush-color').value;
              const size = document.getElementById('brush-size').value;
              
              preview.style.backgroundColor = color;
              preview.style.width = Math.max(10, Math.min(40, size)) + 'px';
              preview.style.height = Math.max(10, Math.min(40, size)) + 'px';
            }
            
            updateTimer(timeString, timeLeft) {
              const timer = document.getElementById('drawing-timer');
              timer.textContent = timeString;
              
              if (timeLeft <= 10) {
                timer.classList.add('timer-urgent');
              } else {
                timer.classList.remove('timer-urgent');
              }
            }
            
            handleAutoSubmit() {
              const submitBtn = document.getElementById('submit-btn');
              const imageData = this.canvas.toDataURL('image/png');
              
              submitBtn.disabled = true;
              submitBtn.textContent = 'Auto-Submitted';
              submitBtn.classList.add('auto-submitted');
              
              window.parent.postMessage({
                type: 'drawing-auto-submitted',
                imageData: imageData
              }, '*');
            }
          }
          
          let drawingInterface;
          
          document.addEventListener('DOMContentLoaded', () => {
            drawingInterface = new DrawingInterface();
          });
          
          window.addEventListener('message', (event) => {
            if (event.data.type === 'timer-update' && drawingInterface) {
              drawingInterface.updateTimer(event.data.timeString, event.data.timeLeft);
            }
            
            if (event.data.type === 'auto-submit' && drawingInterface) {
              drawingInterface.handleAutoSubmit();
            }
          });
        </script>
      </body>
      </html>
    `);
    
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    `;
    
    overlay.appendChild(iframe);
    document.body.appendChild(overlay);
    
    // Listen for messages from the drawing interface
    window.addEventListener('message', (event) => {
      if (event.data.type === 'drawing-submitted') {
        this.handleDrawingSubmission(event.data.imageData);
        this.hideDrawingOverlay();
      }
      
      if (event.data.type === 'drawing-auto-submitted') {
        this.handleDrawingSubmission(event.data.imageData, true);
        this.hideDrawingOverlay();
      }
    });
  }

  // Enhanced drawing submission handler with validation
  handleDrawingSubmission(imageData, isAutoSubmit = false) {
    console.log('🎨 Handling drawing submission...');
    console.log('🎨 Image data length:', imageData?.length || 0);
    console.log('🎨 Image data preview:', imageData?.substring(0, 50));
    console.log('🎨 Is auto-submit:', isAutoSubmit);
    
    // Validate image data
    if (!imageData || typeof imageData !== 'string') {
      console.error('❌ Invalid image data received');
      this.showError('Invalid drawing data');
      return;
    }
    
    if (!imageData.startsWith('data:image/')) {
      console.error('❌ Image data does not start with data:image/');
      this.showError('Invalid image format');
      return;
    }
    
    if (imageData.length < 100) {
      console.error('❌ Image data too short:', imageData.length);
      this.showError('Drawing appears to be empty');
      return;
    }
    
    // Test if the image data is valid by creating an image
    this.validateImageData(imageData).then((isValid) => {
      if (isValid) {
        console.log('✅ Image data validation passed');
        if (isAutoSubmit) {
          this.socket.emit('auto-submit-response', { imageData });
          this.showMessage('Time up! Drawing auto-submitted.');
        } else {
          this.socket.emit('submit-drawing', { imageData });
          this.showMessage('Drawing submitted successfully!');
        }
      } else {
        console.error('❌ Image data validation failed');
        this.showError('Drawing data is corrupted');
      }
    });
  }

  // Add image validation method
  validateImageData(imageData) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        console.log('✅ Image data loaded successfully for validation');
        console.log('✅ Image dimensions:', img.width, 'x', img.height);
        resolve(true);
      };
      
      img.onerror = (error) => {
        console.error('❌ Image data failed to load for validation:', error);
        resolve(false);
      };
      
      // Set a timeout for validation
      setTimeout(() => {
        console.warn('⚠️ Image validation timeout');
        resolve(false);
      }, 5000);
      
      img.src = imageData;
    });
  }

  hideDrawingOverlay() {
    const overlay = document.getElementById('drawing-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  showWaitingArea(title, message) {
    console.log('Showing waiting area:', title);
    
    const waitingArea = document.getElementById('waiting-area');
    const waitingTitle = document.getElementById('waiting-title');
    const waitingMessage = document.getElementById('waiting-message');
    
    if (waitingArea) waitingArea.classList.remove('hidden');
    
    // Hide other areas
    this.hideAllPlayerViews();
    if (waitingArea) waitingArea.classList.remove('hidden');
    
    if (waitingTitle) waitingTitle.textContent = title;
    if (waitingMessage) waitingMessage.textContent = message;
  }

  hideAllPlayerViews() {
    const views = ['monster-view', 'waiting-area'];
    views.forEach(viewId => {
      const view = document.getElementById(viewId);
      if (view) view.classList.add('hidden');
    });
    
    // Also hide drawing overlay
    this.hideDrawingOverlay();
  }

  showNextRoundButton(gameState) {
    const waitingArea = document.getElementById('waiting-area');
    if (!waitingArea) return;
    
    const isLastRound = gameState.currentRound >= gameState.maxRounds;
    
    const buttonHtml = `
      <div class="waiting-host-controls">
        <button id="next-round-waiting-btn" class="party-btn ${isLastRound ? 'finish-btn' : 'next-btn'}">
          ${isLastRound ? 'Finish Game' : 'Next Round'}
        </button>
      </div>
    `;
    
    waitingArea.innerHTML += buttonHtml;
    
    const nextRoundBtn = document.getElementById('next-round-waiting-btn');
    if (nextRoundBtn) {
      nextRoundBtn.addEventListener('click', () => {
        this.socket.emit('next-round');
      });
    }
  }

  updateGameTimer(timeLeft, phase) {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update local timers
    const timers = document.querySelectorAll('.drawing-timer, .study-timer, .waiting-timer');
    timers.forEach(timer => {
      if (timer && !timer.classList.contains('hidden')) {
        timer.textContent = timeString;
        
        if (timeLeft <= 10) {
          timer.classList.add('timer-urgent');
        } else {
          timer.classList.remove('timer-urgent');
        }
      }
    });
    
    // Send to cast display
    this.sendToCastDisplay('timer-update', {
      timeString,
      timeLeft,
      phase
    });
    
    // Send to drawing overlay
    const drawingOverlay = document.getElementById('drawing-overlay');
    if (drawingOverlay) {
      const iframe = drawingOverlay.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'timer-update',
          timeString,
          timeLeft
        }, '*');
      }
    }
    
    // Play buzzer at end
    if (timeLeft === 0) {
      this.playBuzzer();
    }
  }

  updateDrawingProgress(data) {
    // Send to cast display
    this.sendToCastDisplay('drawing-progress', data);
    
    this.showMessage(`${data.playerName} finished drawing! (${data.totalSubmitted}/${data.totalExpected})`);
  }

  // Legacy method for compatibility
  submitDrawing(imageData) {
    this.handleDrawingSubmission(imageData, false);
  }

  handleAutoSubmit() {
    // Send message to drawing overlay
    const drawingOverlay = document.getElementById('drawing-overlay');
    if (drawingOverlay) {
      const iframe = drawingOverlay.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          type: 'auto-submit'
        }, '*');
      }
    }
  }

  // Legacy method for compatibility
  handleAutoSubmitResponse(imageData) {
    this.handleDrawingSubmission(imageData, true);
  }

  handleGameFinished(data) {
    console.log('Game finished:', data);
    this.stopAllMusicImmediate();
    
    // Send to cast display
    this.sendToCastDisplay('game-finished', data);
    
    this.showWaitingArea('Game Complete!', 'Thanks for playing! The host can start a new game.');
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
    
    const toast = document.createElement('div');
    toast.className = 'party-toast error-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 4000);
  }

  showMessage(message) {
    console.log('Message:', message);
    
    const toast = document.createElement('div');
    toast.className = 'party-toast success-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  // Cast methods
  sendToCastDisplay(type, data) {
    if (this.castManager) {
      this.castManager.sendToCast(type, data);
    }
  }

  cleanup() {
    console.log('Cleaning up party mode...');
    
    // Stop all audio
    this.stopAllMusicImmediate();
    this.currentMusicPhase = null;
    
    // Clear timers
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    
    // Cleanup cast manager
    if (this.castManager) {
      this.castManager.cleanup();
    }
    
    // Hide drawing overlay
    this.hideDrawingOverlay();
    
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
    this.currentRoom = null;
    
    // Reset UI
    this.updateConnectionStatus('Not Connected');
  }
}

// Custom Cast Manager with Enhanced Image Processing and Debugging
class CustomCastManager {
  constructor(partyClient) {
    this.partyClient = partyClient;
    this.castSession = null;
    this.APPLICATION_ID = '570D13B8';
    this.useDefaultReceiver = false;
    this.init();
  }

  init() {
    if (!window.chrome || !window.chrome.cast) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.onload = () => this.setupCast();
      script.onerror = () => this.showError('Failed to load Cast SDK');
      document.head.appendChild(script);
    } else {
      this.setupCast();
    }
  }

  setupCast() {
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
        this.initializeCast();
      } else {
        this.showError('Google Cast not available');
      }
    };
  }

  initializeCast() {
    try {
      const castContext = cast.framework.CastContext.getInstance();
      castContext.setOptions({
        receiverApplicationId: this.useDefaultReceiver
          ? chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID
          : this.APPLICATION_ID,
        autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      castContext.addEventListener(
        cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event) => this.onCastStateChanged(event)
      );

      this.updateCastButton('ready');
      console.log('Cast initialized with Application ID:', this.useDefaultReceiver ? 'DEFAULT_MEDIA_RECEIVER' : this.APPLICATION_ID);
    } catch (error) {
      console.error('Cast init failed:', error);
      this.showError('Cast initialization failed');
    }
  }

  onCastStateChanged(event) {
    const castState = event.castState;
    const castBtn = document.getElementById('cast-to-tv-btn');

    switch (castState) {
      case cast.framework.CastState.CONNECTED:
        this.castSession = cast.framework.CastContext.getInstance().getCurrentSession();
        if (castBtn) {
          castBtn.classList.add('connected');
          castBtn.innerHTML = '📺 Connected';
        }
        this.partyClient.showMessage('Connected to Chromecast! Game will display on TV.');
        if (!this.useDefaultReceiver) {
          this.sendInitialGameData();
        }
        break;

      case cast.framework.CastState.CONNECTING:
        if (castBtn) {
          castBtn.classList.add('connecting');
          castBtn.innerHTML = '📺 Connecting...';
        }
        break;

      case cast.framework.CastState.NOT_CONNECTED:
        this.castSession = null;
        if (castBtn) {
          castBtn.classList.remove('connected', 'connecting');
          castBtn.innerHTML = '📺 Cast to TV';
        }
        break;
    }
  }

  handleCastClick() {
    if (this.castSession) {
      this.partyClient.showMessage('Already connected to Chromecast. Game is displaying on TV.');
    } else {
      try {
        const castContext = cast.framework.CastContext.getInstance();
        castContext.requestSession()
          .then(() => {
            console.log('Cast session started');
          })
          .catch((error) => {
            if (error.code !== 'cancel') {
              console.error('Cast error:', error);
              this.partyClient.showError('Failed to connect to Chromecast');
            }
          });
      } catch (error) {
        console.error('Cast click error:', error);
        this.partyClient.showError('Cast not available');
      }
    }
  }

  sendInitialGameData() {
    console.log('🎮 Sending initial game data to cast...');
    if (this.castSession && this.partyClient.currentRoom) {
      this.sendMessage('room-code', {
        roomCode: this.partyClient.roomCode
      });

      if (this.partyClient.currentRoom.gameState) {
        this.sendMessage('game-update', {
          gameState: this.partyClient.currentRoom.gameState,
          room: this.partyClient.currentRoom
        });
      }
    }
  }

  // Enhanced image compression with debugging
  async compressImageData(imageData, quality = 0.7) {
    return new Promise((resolve) => {
      console.log('🗜️ Starting image compression...');
      console.log('🗜️ Original data length:', imageData.length);
      console.log('🗜️ Original data preview:', imageData.substring(0, 50));
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        console.log('🗜️ Image loaded for compression:', img.width, 'x', img.height);
        
        // Set canvas size (reduce if too large)
        const maxSize = 400; // Reduce image size for cast
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        console.log('🗜️ Canvas size for compression:', canvas.width, 'x', canvas.height);
        
        // Fill with white background first
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        try {
          const compressedData = canvas.toDataURL('image/jpeg', quality);
          console.log('🗜️ Compressed data length:', compressedData.length);
          console.log('🗜️ Compression ratio:', Math.round(compressedData.length/imageData.length*100) + '%');
          console.log('🗜️ Compressed data preview:', compressedData.substring(0, 50));
          resolve(compressedData);
        } catch (error) {
          console.error('🗜️ Compression failed:', error);
          resolve(imageData); // Return original on error
        }
      };
      
      img.onerror = (error) => {
        console.error('🗜️ Failed to load image for compression:', error);
        console.error('🗜️ Image data that failed:', imageData.substring(0, 100));
        resolve(imageData); // Return original on error
      };
      
      img.src = imageData;
    });
  }

  // Process drawings with compression
  async processDrawingsForCast(drawings) {
    if (!drawings || drawings.length === 0) return [];
    
    console.log('🖼️ Processing drawings for cast...');
    const processedDrawings = [];
    
    for (let i = 0; i < drawings.length; i++) {
      const drawing = drawings[i];
      console.log(`Processing drawing ${i + 1}/${drawings.length} for ${drawing.playerName}`);
      
      if (drawing.imageData) {
        try {
          const compressedImage = await this.compressImageData(drawing.imageData, 0.6);
          processedDrawings.push({
            ...drawing,
            imageData: compressedImage
          });
        } catch (error) {
          console.error('Error processing drawing:', error);
          // Use original if compression fails
          processedDrawings.push(drawing);
        }
      } else {
        processedDrawings.push(drawing);
      }
    }
    
    return processedDrawings;
  }

  sendToCast(type, data) {
    console.log('📡 sendToCast called:', type);
    
    if (type === 'show-drawings') {
      this.sendDrawingsData(data);
    } else {
      this.sendMessage(type, data);
    }
  }

  async sendDrawingsData(data) {
    console.log('🎨 Sending drawings data...');
    
    try {
      // Process drawings with compression
      const processedDrawings = await this.processDrawingsForCast(data.drawings);
      
      // Calculate message size
      const testMessage = {
        type: 'show-drawings',
        drawings: processedDrawings,
        originalMonster: data.originalMonster
      };
      
      const messageSize = JSON.stringify(testMessage).length;
      console.log(`📏 Message size: ${messageSize} characters`);
      
      if (messageSize > 64000) { // Cast SDK limit is around 64KB
        console.log('📦 Message too large, splitting...');
        await this.sendDrawingsInChunks(processedDrawings, data.originalMonster);
      } else {
        console.log('📤 Sending complete drawings message...');
        this.sendMessage('show-drawings', {
          drawings: processedDrawings,
          originalMonster: data.originalMonster
        });
      }
    } catch (error) {
      console.error('Error sending drawings data:', error);
      this.partyClient.showError('Failed to send drawings to TV');
    }
  }

  async sendDrawingsInChunks(drawings, originalMonster) {
    console.log('📦 Splitting drawings into chunks...');
    
    // Send original monster first
    this.sendMessage('show-drawings-start', {
      originalMonster: originalMonster,
      totalDrawings: drawings.length
    });
    
    // Send drawings one by one
    for (let i = 0; i < drawings.length; i++) {
      console.log(`📤 Sending drawing ${i + 1}/${drawings.length}`);
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between messages
      
      this.sendMessage('show-drawing-chunk', {
        drawing: drawings[i],
        index: i,
        isLast: i === drawings.length - 1
      });
    }
    
    // Send completion message
    this.sendMessage('show-drawings-complete', {});
  }

  sendMessage(type, data) {
    if (!this.castSession) {
      console.error('❌ No cast session available for message:', type);
      return;
    }

    try {
      const message = { type, ...data };
      const messageSize = JSON.stringify(message).length;
      
      console.log('=== SENDING TO CAST ===');
      console.log('Type:', type);
      console.log('Message size:', messageSize, 'characters');
      
      if (messageSize > 64000) {
        console.error('❌ Message too large:', messageSize);
        this.partyClient.showError(`Message too large for Cast: ${messageSize} characters`);
        return;
      }
      
      this.castSession.sendMessage(
        'urn:x-cast:com.drawblins.gamedata',
        message
      ).then(() => {
        console.log('✅ Cast message sent successfully:', type);
      }).catch((error) => {
        console.error('❌ Cast message error:', error);
        if (error === 'invalid_parameter') {
          console.error('Message was likely too large or contained invalid data');
          this.partyClient.showError('Message too large for Cast TV');
        }
      });
    } catch (error) {
      console.error('❌ Send message error:', error);
    }
  }

  updateCastButton(state) {
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (!castBtn) return;

    switch (state) {
      case 'ready':
        castBtn.innerHTML = '📺 Cast to TV';
        castBtn.disabled = false;
        castBtn.title = 'Cast game display to your TV';
        break;
      case 'connecting':
        castBtn.innerHTML = '📺 Connecting...';
        castBtn.disabled = true;
        break;
      case 'connected':
        castBtn.innerHTML = '📺 Connected';
        castBtn.disabled = false;
        castBtn.title = 'Game is displaying on TV';
        break;
    }
  }

  showError(message) {
    console.error('Cast error:', message);
    if (this.partyClient) {
      this.partyClient.showError(message);
    }
  }

  cleanup() {
    if (this.castSession) {
      try {
        this.castSession.endSession(false);
      } catch (error) {
        console.log('Error ending cast session:', error);
      }
      this.castSession = null;
    }

    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      castBtn.classList.remove('connected', 'connecting');
      castBtn.innerHTML = '📺 Cast to TV';
      castBtn.disabled = false;
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
    console.log('Enhanced party client initialized');
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (partyClient) {
    partyClient.cleanup();
  }
});