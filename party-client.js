// Enhanced Party Mode Client - Universal Casting Like YouTube/Netflix
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
    // Add storage for preventing accumulation
    this.lastSentDrawings = null;
    // Online Party Mode support
    this.isOnlinePartyMode = null;
    this.spectatorWindow = null;
   // Replace lines 19-30 in your constructor with this:

// FIXED: Better iOS and browser detection for casting
this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
this.isChrome = /Chrome|CriOS/.test(navigator.userAgent); // Include Chrome on iOS (CriOS)
this.isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS/.test(navigator.userAgent);
this.isIOSSafari = this.isIOS && this.isSafari;
this.isChromeOnIOS = this.isIOS && /CriOS/.test(navigator.userAgent);

console.log('🔍 Device Detection:', {
  isIOS: this.isIOS,
  isChrome: this.isChrome,
  isSafari: this.isSafari,
  isIOSSafari: this.isIOSSafari,
  isChromeOnIOS: this.isChromeOnIOS,
  userAgent: navigator.userAgent.substring(0, 100) + '...'
});

// FIXED: Proper casting capability detection
this.canUseChromecast = this.isChrome; // Chrome on ANY platform (including iOS)
this.canUseAirPlay = this.isIOS; // Any browser on iOS can potentially use AirPlay
this.canCast = true; // Always allow casting attempts - let the system figure it out
    
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 5;
    this.reconnectInterval = null;
    this.heartbeatInterval = null;
    this.isInRoom = false;
    this.forceDisconnectOnCleanup = false;
    
    // Visibility API for iOS background detection
    this.visibilityChangeHandler = null;
    this.pageHideHandler = null;
    this.beforeUnloadHandler = null;
  }

  // Initialize party mode
init() {
  console.log('Initializing Enhanced Party Mode...');
  this.setupAudio();
  this.setupIOSSupport();
  this.setupVisibilityHandlers();
  
  // FIXED: Force online party mode detection from global flag
  if (window.onlinePartyMode === true || window.getCurrentGameMode?.() === 'online-party') {
    console.log('🌐 FORCING Online Party Mode from window flags');
    this.isOnlinePartyMode = true;
  } else if (this.isOnlinePartyMode === null) {
    console.log('🔍 Detecting party mode...');
    this.isOnlinePartyMode = this.detectOnlinePartyMode();
  }
  
  console.log('🔍 Mode detection FINAL:', {
    windowOnlinePartyMode: window.onlinePartyMode,
    getCurrentGameMode: window.getCurrentGameMode?.(),
    isOnlinePartyMode: this.isOnlinePartyMode,
    isIOS: this.isIOS,
    isIOSSafari: this.isIOSSafari,
    canCast: this.canCast
  });
  
  this.createPartyModeUI();
  
  if (this.isOnlinePartyMode) {
    console.log('🌐 Online Party Mode detected - updating UI');
    this.initializeOnlinePartyMode();
  } else {
    console.log('📺 Regular Party Mode detected - initializing Universal Cast');
    this.initializeUniversalCast();
  }
}

  

  
setOnlinePartyMode(mode) {
  console.log("🔧🔧🔧 setOnlinePartyMode called with:", mode);
  console.log("🔧🔧🔧 Before setting - this.isOnlinePartyMode:", this.isOnlinePartyMode);
  console.log("🔧🔧🔧 window.onlinePartyMode:", window.onlinePartyMode);
  console.log("🔧🔧🔧 window.getCurrentGameMode():", window.getCurrentGameMode?.());
  
  this.isOnlinePartyMode = mode;
  
  console.log("🔧🔧🔧 After setting - this.isOnlinePartyMode:", this.isOnlinePartyMode);
  
  // FORCE immediate UI update based on mode
  if (mode === true) {
    console.log("🌐🌐🌐 IMMEDIATE: Switching to Online Party Mode");
    setTimeout(() => {
      console.log("🌐🌐🌐 Running updatePartyUIForOnlineMode...");
      this.updatePartyUIForOnlineMode();
    }, 100);
  } else {
    console.log("📺📺📺 IMMEDIATE: Switching to Regular Party Mode");
    setTimeout(() => {
      console.log("📺📺📺 Running updatePartyUIForRegularMode...");
      this.updatePartyUIForRegularMode();
    }, 100);
  }
  
  console.log("🔧🔧🔧 Mode set via menu:", mode ? "Online Party Mode" : "Regular Party Mode");
}

  // FIX: Better detection method for online party mode
detectOnlinePartyMode() {
  return window.onlinePartyMode === true || 
         window.getCurrentGameMode?.() === 'online-party' ||
         document.body.classList.contains('online-party-mode') ||
         window.location.hash.includes('online-party') ||
         window.location.search.includes('mode=online-party') ||
         false;
}

  // Setup iOS-specific support
  setupIOSSupport() {
    if (!this.isIOS) return;
    
    console.log('📱 Setting up iOS-specific support...');
    
    // iOS needs different WebSocket handling
    this.iosSocketOptions = {
      transports: ['polling', 'websocket'], // Prefer polling on iOS
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    };
  }

  

 // ENHANCED: Better beforeunload handler specifically for hosts
setupVisibilityHandlers() {
  // Page visibility API
  this.visibilityChangeHandler = () => {
    if (document.hidden) {
      console.log('📱 Page hidden - handling iOS background state');
      this.handlePageHidden();
    } else {
      console.log('📱 Page visible - handling iOS foreground state');
      this.handlePageVisible();
    }
  };

  // Page hide event (better for iOS)
  this.pageHideHandler = () => {
    console.log('📱 Page hide event - iOS cleanup');
    this.handlePageHidden();
  };

  // ENHANCED: Better before unload handler
  this.beforeUnloadHandler = (e) => {
    console.log('📱 Before unload - final cleanup', {
      isHost: this.isHost,
      isInRoom: this.isInRoom
    });
    
    // Special handling for hosts
    if (this.isHost && this.isInRoom) {
      console.log('🚨 HOST is leaving page - immediate disconnect');
      this.forceDisconnectOnCleanup = true;
      
      // Try to notify server that host is leaving
      if (this.socket && this.isConnected) {
        this.socket.emit('host-leaving', {
          roomCode: this.roomCode,
          playerName: this.playerName
        });
      }
    }
    
    this.cleanup();
  };

  document.addEventListener('visibilitychange', this.visibilityChangeHandler);
  window.addEventListener('pagehide', this.pageHideHandler);
  window.addEventListener('beforeunload', this.beforeUnloadHandler);
}

handleUserNavigation() {
  if (this.isHost && this.isInRoom) {
    console.log('🚨 Host attempting to navigate away');
    
    // Show confirmation dialog
    const shouldLeave = confirm('You are the host! Leaving will end the game for all players. Are you sure?');
    
    if (shouldLeave) {
      this.detectHostDisconnect();
    }
    
    return shouldLeave;
  } else if (this.isInRoom) {
    // Regular player leaving
    this.handlePlayerLeaveGame();
    return true;
  }
  
  return true;
}

// ENHANCED: Add browser navigation interception
interceptBrowserNavigation() {
  // Intercept back button and other navigation
  window.addEventListener('popstate', (e) => {
    if (this.isInRoom) {
      console.log('🔄 Browser navigation detected');
      e.preventDefault();
      
      if (!this.handleUserNavigation()) {
        // If user cancels leaving, push state back
        history.pushState(null, null, window.location.href);
      }
    }
  });
  
  // Push initial state to enable popstate detection
  if (this.isInRoom) {
    history.pushState(null, null, window.location.href);
  }
}

  // Handle iOS page hidden state
  handlePageHidden() {
    if (this.socket && this.isConnected && this.isIOS) {
      // On iOS, we need to disconnect cleanly when backgrounded
      console.log('📱 iOS: Disconnecting due to background state');
      this.socket.disconnect();
    }
  }

  // Handle iOS page visible state
  handlePageVisible() {
    if (this.isIOS && this.isInRoom && (!this.socket || !this.isConnected)) {
      console.log('📱 iOS: Reconnecting due to foreground state');
      setTimeout(() => {
        this.reconnectToRoom();
      }, 1000);
    }
  }

  // Reconnect to existing room (iOS support)
  reconnectToRoom() {
    if (!this.playerName || !this.roomCode) {
      console.log('📱 No room data to reconnect to');
      return;
    }

    console.log('📱 Attempting to reconnect to room:', this.roomCode);
    this.connect();
    
    // Give connection time to establish
    setTimeout(() => {
      if (this.isConnected) {
        this.joinExistingRoom();
      }
    }, 2000);
  }

  // Join existing room after reconnection
  joinExistingRoom() {
    console.log('📱 Rejoining room after reconnection...');
    this.socket.emit('join-room', { 
      roomCode: this.roomCode, 
      playerName: this.playerName,
      reconnecting: true
    });
  }

  

// Initialize Online Party Mode
initializeOnlinePartyMode() {
  console.log('🌐 Setting up Online Party Mode UI updates...');
  
  // Wait for the party UI to be fully created
  setTimeout(() => {
    this.updatePartyUIForOnlineMode();
  }, 500); // Give more time for UI creation
}

// NEW METHOD: Update the actual party UI (not menu) for online mode
updatePartyUIForOnlineMode() {
  console.log('🌐 Updating party UI for Online Party Mode...');
  
  // Update the party mode section title (the actual game UI, not menu)
  const partyModeSection = document.getElementById('party-mode-section');
  if (partyModeSection) {
    // Update the main title in the party UI
    const partyTitle = partyModeSection.querySelector('h3');
    if (partyTitle) {
      console.log('📝 Updating party section title');
      partyTitle.textContent = 'Online Party Mode';
    }
    
    // Update the description in the party UI  
    const partyDescription = partyTitle ? partyTitle.nextElementSibling : null;
    if (partyDescription && partyDescription.tagName === 'P') {
      console.log('📝 Updating party section description');
      partyDescription.textContent = 'Play together with web spectator view - everyone uses their own device!';
    }
    
    // Most importantly: Update the cast button
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      console.log('🔄 Updating cast button for Online Party Mode');
      castBtn.innerHTML = '🖥️ Open Spectator View';
      castBtn.title = 'Open spectator view in new window';
      
      // Remove any cast-specific styling
      castBtn.classList.remove('cast-btn');
      castBtn.classList.add('spectator-btn');
      
      // Make sure it's enabled
      castBtn.disabled = false;
    }
    
    // Hide cast info for online mode
    const castInfo = partyModeSection.querySelector('.cast-info');
    if (castInfo) {
      console.log('🙈 Hiding cast info for Online Party Mode');
      castInfo.style.display = 'none';
    }
    
    // Add spectator info
    this.addSpectatorInfo(partyModeSection);
    
    console.log('✅ Online Party Mode UI updates complete');
  } else {
    console.error('❌ Party mode section not found for UI updates');
    // Retry after more time
    setTimeout(() => {
      this.updatePartyUIForOnlineMode();
    }, 1000);
  }
}

// NEW METHOD: Add spectator-specific info
addSpectatorInfo(partyModeSection) {
  // Check if spectator info already exists
  const existingSpectatorInfo = partyModeSection.querySelector('.spectator-info');
  if (existingSpectatorInfo) {
    return; // Already added
  }
  
  // Create spectator info element
  const spectatorInfo = document.createElement('div');
  spectatorInfo.className = 'spectator-info';
  spectatorInfo.innerHTML = `
    <div style="
      background: rgba(230, 126, 34, 0.1);
      border: 1px solid #e67e22;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      color: #e67e22;
      font-size: 14px;
      text-align: center;
    ">
      🌐 <strong>Online Party Mode:</strong> Web spectator view instead of TV casting
    </div>
  `;
  
  // Insert after the description
  const description = partyModeSection.querySelector('p');
  if (description) {
    description.parentNode.insertBefore(spectatorInfo, description.nextSibling);
    console.log('📋 Added spectator info');
  }
}

// NEW METHOD: Reset UI back to regular party mode
updatePartyUIForRegularMode() {
  console.log('📺 Updating party UI for Regular Party Mode...');
  
  const partyModeSection = document.getElementById('party-mode-section');
  if (partyModeSection) {
    // Reset the main title in the party UI
    const partyTitle = partyModeSection.querySelector('h3');
    if (partyTitle) {
      console.log('📝 Resetting party section title to Regular Party Mode');
      partyTitle.textContent = 'Party Mode';
    }
    
    // Reset the description in the party UI  
    const partyDescription = partyTitle ? partyTitle.nextElementSibling : null;
    if (partyDescription && partyDescription.tagName === 'P') {
      console.log('📝 Resetting party section description');
      partyDescription.textContent = 'Play together - everyone uses their own device!';
    }
    
    // Most importantly: Reset the cast button
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      console.log('🔄 Resetting cast button for Regular Party Mode');
      castBtn.innerHTML = '📺 Cast';
      castBtn.title = 'Cast to TV';
      
      // Reset styling
      castBtn.classList.remove('spectator-btn');
      castBtn.classList.add('cast-btn');
      
      // Make sure it's enabled
      castBtn.disabled = false;
    }
    
    // Show cast info for regular mode
    const castInfo = partyModeSection.querySelector('.cast-info');
    if (castInfo) {
      console.log('👁️ Showing cast info for Regular Party Mode');
      castInfo.style.display = 'block';
    }
    
    // Remove spectator info
    this.removeSpectatorInfo(partyModeSection);
    
    console.log('✅ Regular Party Mode UI updates complete');
  } else {
    console.error('❌ Party mode section not found for UI reset');
  }
}

// NEW METHOD: Remove spectator-specific info
removeSpectatorInfo(partyModeSection) {
  const existingSpectatorInfo = partyModeSection.querySelector('.spectator-info');
  if (existingSpectatorInfo) {
    existingSpectatorInfo.remove();
    console.log('🗑️ Removed spectator info');
  }
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

// Initialize Universal Cast SDK - YouTube/Netflix style
initializeUniversalCast() {
  console.log('🎯 Initializing Universal Cast...');
  console.log('🎯 Capabilities:', {
    canUseChromecast: this.canUseChromecast,
    canUseAirPlay: this.canUseAirPlay,
    isOnlinePartyMode: this.isOnlinePartyMode
  });
  
  if (!this.isOnlinePartyMode) {
    // Try Chromecast first (works on Chrome on any platform including iOS)
    if (this.canUseChromecast) {
      console.log('📡 Initializing Chromecast (Chrome detected)');
      this.castManager = new UniversalCastManager(this);
    } else if (this.canUseAirPlay) {
      console.log('🍎 Initializing AirPlay fallback (iOS detected)');
      this.castManager = new UniversalCastManager(this);
    } else {
      console.log('❌ No casting method available');
      // Still create cast manager for fallback guidance
      this.castManager = new UniversalCastManager(this);
    }
  } else {
    console.log('🌐 Online Party Mode - skipping cast initialization');
  }
}
// FIX: Better cast/spectator button handling
handleCastClick() {
  console.log('🎯🎯🎯 Cast button clicked - DEBUGGING:');
  console.log('🎯🎯🎯 this.isOnlinePartyMode:', this.isOnlinePartyMode);
  console.log('🎯🎯🎯 window.onlinePartyMode:', window.onlinePartyMode);
  console.log('🎯🎯🎯 Mode should be:', this.isOnlinePartyMode ? 'online' : 'cast');
  
  console.log('🎯 Cast button clicked - Mode:', this.isOnlinePartyMode ? 'online' : 'cast');
  
  if (this.isOnlinePartyMode) {
    console.log('🌐🌐🌐 Calling handleSpectatorClick...');
    this.handleSpectatorClick();
  } else if (this.castManager) {
    console.log('📡📡📡 Calling castManager.handleCastClick...');
    this.castManager.handleCastClick();
  } else {
    // FIX: Fallback for when cast manager fails to initialize
    console.log('⚠️⚠️⚠️ Cast manager not available, falling back to spectator mode');
    this.handleSpectatorClick();
  }
}

  // FIX: Improved spectator window handling
  handleSpectatorClick() {
    console.log('🖥️ Opening spectator view...');
    
    if (this.spectatorWindow && !this.spectatorWindow.closed) {
      this.spectatorWindow.focus();
      this.showMessage('Spectator view is already open!');
      return;
    }

    try {
      // FIX: Better URL construction for spectator view
      let spectatorUrl = 'viewer.html';
      
      // Add room code to URL if we have one
      if (this.roomCode) {
        spectatorUrl += `?room=${this.roomCode}`;
      }
      
      console.log('🖥️ Opening spectator URL:', spectatorUrl);
      
      this.spectatorWindow = window.open(
        spectatorUrl, 
        'DrawblinsSpectator', 
        'width=1200,height=800,scrollbars=no,resizable=yes,location=no,menubar=no,toolbar=no'
      );
      
      if (this.spectatorWindow) {
        this.showMessage('Spectator view opened! Game will display in the new window.');
        
        // Update button
        const castBtn = document.getElementById('cast-to-tv-btn');
        if (castBtn) {
          castBtn.innerHTML = '🖥️ Spectator Open';
          castBtn.classList.add('connected');
        }
        
        // FIX: Better event handling for spectator window
        this.setupSpectatorWindowEvents();
        
      } else {
        console.error('❌ Failed to open spectator window - likely popup blocked');
        this.showError('Failed to open spectator window. Please allow popups and try again.');
      }
    } catch (error) {
      console.error('❌ Error opening spectator window:', error);
      this.showError('Failed to open spectator window: ' + error.message);
    }
  }

  // FIX: Better spectator window event handling
  setupSpectatorWindowEvents() {
    // Check if window closed periodically
    const checkClosed = () => {
      if (this.spectatorWindow && this.spectatorWindow.closed) {
        console.log('🖥️ Spectator window closed');
        this.spectatorWindow = null;
        
        // Reset button
        const castBtn = document.getElementById('cast-to-tv-btn');
        if (castBtn) {
          castBtn.innerHTML = '🖥️ Open Spectator View';
          castBtn.classList.remove('connected');
        }
        return;
      }
      
      if (this.spectatorWindow) {
        setTimeout(checkClosed, 1000);
      }
    };
    
    setTimeout(checkClosed, 1000);
    
    // Send initial data when window is ready
    setTimeout(() => {
      this.sendInitialSpectatorData();
    }, 2000);
  }

  // Send initial data to spectator
  sendInitialSpectatorData() {
    if (!this.spectatorWindow || this.spectatorWindow.closed) {
      console.log('⚠️ Spectator window not available for initial data');
      return;
    }

    console.log('📤 Sending initial data to spectator...');
    
    if (this.currentRoom) {
      this.sendToSpectator('room-code', {
        roomCode: this.roomCode
      });

      if (this.currentRoom.gameState) {
        this.sendToSpectator('game-update', {
          gameState: this.currentRoom.gameState,
          room: this.currentRoom
        });
      }
    }
  }

  // FIX: Improved spectator communication with error handling
  sendToSpectator(type, data) {
    if (!this.spectatorWindow || this.spectatorWindow.closed) {
      console.log('⚠️ Spectator window not available');
      return false;
    }

    try {
      const message = {
        type: type,
        data: data,
        timestamp: Date.now()
      };
      
      console.log('📤 Sending to spectator:', type, data);
      this.spectatorWindow.postMessage(message, '*');
      return true;
    } catch (error) {
      console.error('❌ Failed to send to spectator:', error);
      return false;
    }
  }

  // Universal method to send to display (Cast or Spectator)
  sendToCastDisplay(type, data) {
    if (this.isOnlinePartyMode) {
      this.sendToSpectator(type, data);
    } else if (this.castManager) {
      this.castManager.sendToCast(type, data);
    }
  }

  // Connect to the backend server with iOS support
  connect() {
    if (this.socket && this.isConnected) {
      console.log('Already connected, skipping connection attempt');
      return;
    }

    console.log('Connecting to:', this.serverUrl);
    console.log('iOS device:', this.isIOS);
    
    // Use different options for iOS
    const socketOptions = this.isIOS ? {
      ...this.iosSocketOptions,
      transports: ['polling', 'websocket']
    } : {
      transports: ['websocket', 'polling'],
      timeout: 10000
    };
    
    console.log('Socket options:', socketOptions);
    
    this.socket = io(this.serverUrl, socketOptions);

    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.socket.on('connect', () => {
      console.log('✅ Connected to party server');
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.updateConnectionStatus('Connected');
      
      // Start heartbeat for iOS
      if (this.isIOS) {
        this.startHeartbeat();
      }
    });

this.socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from party server:', reason);
  console.log('❌ Disconnect context:', {
    isHost: this.isHost,
    isInRoom: this.isInRoom,
    roomCode: this.roomCode,
    reason: reason,
    forceDisconnectOnCleanup: this.forceDisconnectOnCleanup
  });
  
  this.isConnected = false;
  this.updateConnectionStatus('Disconnected');
  
  // Clear heartbeat
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = null;
  }
  
  // CRITICAL FIX: Handle host disconnection differently
  if (this.isHost && this.isInRoom && !this.forceDisconnectOnCleanup) {
    console.log('🚨 HOST DISCONNECTED - Returning to home page immediately');
    
    // Stop all audio
    this.stopAllMusicImmediate();
    
    // Show brief message
    this.showError('Disconnected from server - returning to home page');
    
    // Return to home page immediately - don't try to reconnect
    setTimeout(() => {
      this.returnToHomePage();
    }, 1500);
    
    return; // Don't continue with normal reconnection logic
  }
  
  // For non-hosts or if we're cleaning up normally
  if (!this.forceDisconnectOnCleanup) {
    // Only attempt reconnection if we were in a room and we're not the host
    if (this.isInRoom && !this.isHost && this.connectionAttempts < this.maxConnectionAttempts) {
      console.log('🔄 Attempting reconnection (non-host)...');
      this.connectionAttempts++;
      setTimeout(() => {
        if (!this.isConnected && this.isInRoom) {
          this.connect();
        }
      }, 2000 * this.connectionAttempts);
    } else if (this.isInRoom) {
      // If we can't reconnect or hit max attempts, go home
      console.log('🏠 Cannot reconnect - returning to home page');
      setTimeout(() => {
        this.returnToHomePage();
      }, 1000);
    }
  }
});

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.updateConnectionStatus('Connection Failed');
      this.connectionAttempts++;
      
      if (this.connectionAttempts < this.maxConnectionAttempts) {
        console.log(`🔄 Retrying connection (${this.connectionAttempts}/${this.maxConnectionAttempts})...`);
        setTimeout(() => {
          this.connect();
        }, 2000 * this.connectionAttempts);
      } else {
        this.showError('Failed to connect to server after multiple attempts');
      }
    });

    // Room events
this.socket.on('room-created', (data) => {
  console.log('Room created response:', data);
  if (data.success) {
    this.roomCode = data.roomCode;
    this.currentRoom = data.room;
    this.isHost = true;
    this.isInRoom = true;
    this.showLobby();
    
    // NEW: Setup navigation interception
    this.interceptBrowserNavigation();
    
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
    this.isInRoom = true;
    this.showLobby();
    
    // NEW: Setup navigation interception
    this.interceptBrowserNavigation();
    
    console.log('Joined room successfully');
  } else {
    console.error('Failed to join room:', data.error);
    this.showError(data.error);
    this.isInRoom = false;
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

    // NEW: Listen for host disconnection (updated event name)
    this.socket.on('host-left-room-closed', (data) => {
      console.log('⚠️ Host left and room closed:', data);
      this.handleHostLeftRoomClosed(data);
    });

    // NEW: Keep the original event too for backward compatibility
    this.socket.on('host-left', (data) => {
      console.log('⚠️ Host left the game:', data);
      this.handleHostLeft(data);
    });

    // NEW: Listen for room closure due to host leaving
    this.socket.on('room-closed', (data) => {
      console.log('🚪 Room was closed:', data);
      this.handleRoomClosed(data);
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
      // Clear previous drawings when new phase starts
      if (data.gameState.phase === 'studying') {
        this.lastSentDrawings = null;
      }
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

  // FIXED: NEW - Return to actual home page (index.html)
  returnToHomePage() {
    console.log('🏠 Returning to home page (index.html)...');
    
    // Clean up party mode completely first
    this.cleanup();
    
    // CRITICAL: Navigate to the actual home page
    window.location.href = 'index.html';
  }

  // FIXED: Handle when host leaves and room is closed immediately
  handleHostLeftRoomClosed(data) {
    console.log('🚨 Host left and room closed - returning to HOME PAGE');
    
    // Stop all audio
    this.stopAllMusicImmediate();
    
    // Show notification
    this.showError(data.message || `Game ended: ${data.hostName || 'Host'} left the game`);
    
    // FIXED: Go to home page instead of trying to show local mode
    setTimeout(() => {
      this.returnToHomePage();
    }, 2500);
  }

  // FIXED: Handle when host leaves the game
  handleHostLeft(data) {
    console.log('🚨 Host left - returning to HOME PAGE');
    
    // Stop all audio
    this.stopAllMusicImmediate();
    
    // Show notification
    this.showError(`Game ended: ${data.hostName || 'Host'} left the game`);
    
    // FIXED: Go to home page
    setTimeout(() => {
      this.returnToHomePage();
    }, 2000);
  }

  // FIXED: Handle when room is closed
  handleRoomClosed(data) {
    console.log('🚪 Room closed - returning to HOME PAGE');
    
    // Stop all audio
    this.stopAllMusicImmediate();
    
    // Show notification
    this.showError(data.reason || 'Room was closed');
    
    // FIXED: Go to home page
    setTimeout(() => {
      this.returnToHomePage();
    }, 1500);
  }

  // NEW: Method for when player manually leaves (back button, etc.)
  handlePlayerLeaveGame() {
    console.log('👋 Player leaving game manually...');
    
    // Disconnect from room
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-room', {
        roomCode: this.roomCode,
        playerName: this.playerName
      });
    }
    
    // Clean up and return to home
    this.cleanup();
    
    // Show message briefly then redirect
    this.showMessage('Left the game');
    
    setTimeout(() => {
      this.returnToHomePage();
    }, 1000);
  }

  // ENHANCED: Better cleanup method
  cleanup() {
    console.log('🧹 Cleaning up party mode...');
    
    // Clear all timers
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Stop all audio immediately
    this.stopAllMusicImmediate();
    
    // Close spectator window
    if (this.spectatorWindow && !this.spectatorWindow.closed) {
      this.spectatorWindow.close();
      this.spectatorWindow = null;
    }
    
    // Disconnect cast
    if (this.castManager) {
      this.castManager.disconnect();
    }
    
    // Disconnect socket
    if (this.socket) {
      this.forceDisconnectOnCleanup = true;
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Reset state
    this.isConnected = false;
    this.isInRoom = false;
    this.isHost = false;
    this.roomCode = '';
    this.currentRoom = null;
    this.playerName = '';
    this.connectionAttempts = 0;
    
    // Remove event listeners
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    }
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    }
    
    console.log('✅ Party mode cleanup complete');
  }

  // NEW: Verify that we have the proper home page elements
  verifyHomePageElements() {
    const requiredElements = [
      '#start-screen',
      '#start-buttons', 
      '.container',
      'h1' // Game title
    ];
    
    for (const selector of requiredElements) {
      if (!document.querySelector(selector)) {
        console.log('❌ Missing required element:', selector);
        return false;
      }
    }
    
    console.log('✅ Home page elements verified');
    return true;
  }

  // BACKUP METHOD: Alternative return to main menu (if index.html redirect fails)
  returnToMainMenu() {
    console.log('🏠 Returning to main menu on same page...');
    
    // Clean up party mode completely
    this.cleanup();
    
    // CRITICAL FIX: Check if we're currently on a party-specific page
    const currentPage = window.location.pathname.toLowerCase();
    
    // If we're on a party/game specific page, go to index
    if (currentPage.includes('party') || 
        currentPage.includes('game') || 
        currentPage.includes('lobby') ||
        currentPage === '/viewer.html' ||
        currentPage === '/cast.html') {
      console.log('📍 Currently on game page, redirecting to home...');
      window.location.href = 'index.html';
      return;
    }
    
    // Otherwise try to show the local mode interface
    this.showLocalModeInterface();
    
    // ADDITIONAL: Check if home elements exist, if not redirect
    setTimeout(() => {
      if (!this.verifyHomePageElements()) {
        console.log('⚠️ Home page elements missing, redirecting...');
        window.location.href = 'index.html';
      }
    }, 500);
  }

  // ENHANCED: Show local mode interface with better error handling
  showLocalModeInterface() {
    console.log('📺 Showing local mode interface...');
    
    try {
      // Show main container
      const container = document.querySelector('.container');
      if (container) {
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.classList.remove('hidden', 'party-mode');
        container.classList.add('local-mode');
      }
      
      // Show start screen
      const startScreen = document.getElementById('start-screen');
      if (startScreen) {
        startScreen.classList.remove('hidden');
        startScreen.style.display = 'block';
        startScreen.style.visibility = 'visible';
      }
      
      // Hide party mode section
      const partySection = document.getElementById('party-mode-section');
      if (partySection) {
        partySection.classList.add('hidden');
        partySection.style.display = 'none';
      }
      
      // Show start buttons
      const startButtons = document.getElementById('start-buttons');
      if (startButtons) {
        startButtons.style.display = 'block';
        startButtons.style.visibility = 'visible';
        startButtons.classList.remove('hidden');
      }
      
      // Reset mode buttons
      const localBtn = document.getElementById('local-mode-btn');
      const partyBtn = document.getElementById('party-mode-btn');
      
      if (localBtn) localBtn.classList.add('active');
      if (partyBtn) partyBtn.classList.remove('active');
      
      // Hide all game interfaces
      this.hideAllGameInterfaces();
      
      console.log('✅ Local mode interface shown');
      
    } catch (error) {
      console.error('❌ Error showing local mode interface:', error);
      // Fallback to redirect
      window.location.href = 'index.html';
    }
  }

  // ENHANCED: Hide all game interfaces with thorough cleanup
  hideAllGameInterfaces() {
    console.log('🙈 Hiding all game interfaces...');
    
    // Hide drawing overlay
    this.hideDrawingOverlay();
    
    // Hide any game-specific UI elements
    const gameElements = [
      'party-game-area',
      'monster-view', 
      'waiting-area',
      'drawing-interface',
      'party-lobby', // Also hide lobby when returning to main menu
      'game-interface',
      'game-screen',
      'gameplay-area'
    ];
    
    gameElements.forEach(elementId => {
      const element = document.getElementById(elementId);
      if (element) {
        element.classList.add('hidden');
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        console.log(`✅ Hidden: ${elementId}`);
      }
    });
    
    // Hide any overlays or modals
    const overlays = [
      '.overlay',
      '.modal',
      '.popup',
      '.drawing-overlay',
      '#drawing-overlay'
    ];
    
    overlays.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        element.classList.add('hidden');
        element.style.display = 'none';
        element.style.visibility = 'hidden';
      });
    });
    
    console.log('✅ Game interfaces hidden');
  }

  // EXAMPLE: How to add a "Leave Game" button that works properly
  addLeaveGameButton() {
    // Find or create a leave game button
    let leaveBtn = document.getElementById('leave-game-btn');
    
    if (!leaveBtn) {
      leaveBtn = document.createElement('button');
      leaveBtn.id = 'leave-game-btn';
      leaveBtn.innerHTML = '← Leave Game';
      leaveBtn.className = 'leave-btn';
      leaveBtn.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1000;
        background: #e74c3c;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
      `;
      
      // Add to page
      document.body.appendChild(leaveBtn);
    }
    
    // Remove any existing listeners
    leaveBtn.replaceWith(leaveBtn.cloneNode(true));
    leaveBtn = document.getElementById('leave-game-btn');
    
    // Add click handler
    leaveBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave the game?')) {
        this.handlePlayerLeaveGame();
      }
    });
    
    console.log('✅ Leave game button added');
  }

  // HELPER: Method to show on the correct page type
  showCorrectInterface() {
    // Check what page we're supposed to be on
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    const room = urlParams.get('room');
    
    if (mode === 'party' || room) {
      // We're supposed to be in party mode
      console.log('📍 Should be in party mode');
      this.showPartyMode();
    } else {
      // We should be on the home page
      console.log('📍 Should be on home page');
      if (this.verifyHomePageElements()) {
        this.showLocalModeInterface();
      } else {
        // Redirect to home if elements missing
        window.location.href = 'index.html';
      }
    }
  

    // Show the start screen
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.classList.remove('hidden');
      startScreen.style.display = 'block';
    }
  }

  // Start heartbeat for iOS stability
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.socket.emit('heartbeat');
      }
    }, 25000); // Send heartbeat every 25 seconds for iOS
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

  // Create enhanced party mode UI with universal cast support
  createPartyModeUI() {
    console.log('Creating Enhanced Party Mode UI...');
    const container = document.querySelector('.container');
    
    // Check if already exists
    if (document.getElementById('party-mode-section')) {
      console.log('Party mode UI already exists');
      return;
    }
    
    const startScreen = document.getElementById('start-screen');
    
    // Add party mode section with conditional header
    const partyModeSection = document.createElement('div');
    partyModeSection.id = 'party-mode-section';
    partyModeSection.className = 'party-mode-section hidden';
    
    // The header will be updated in initializeOnlinePartyMode() if needed
    const modeTitle = this.isOnlinePartyMode ? 'Online Party Mode' : 'Party Mode';
    const modeDescription = this.isOnlinePartyMode ? 
      'Play together with web spectator view - everyone uses their own device!' :
      'Play together - everyone uses their own device!';
    
    // FIX: Always show cast as supported for simplicity
    const getCastInfo = () => {
      if (this.isOnlinePartyMode) return '';
      return '<div class="cast-info">✅ Casting supported in this browser</div>';
    };
    
    partyModeSection.innerHTML = `
      <div class="party-mode-card">
        <h3>${modeTitle}</h3>
        <p>${modeDescription}</p>
        ${getCastInfo()}
        
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
                ${this.isOnlinePartyMode ? '🖥️ Open Spectator View' : '📺 Cast'}
              </button>
            </div>
          </div>
          
          <!-- Leave Room Button -->
          <div class="lobby-actions">
            <button id="leave-room-btn" class="party-btn leave-btn">Leave Room</button>
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
          
          <!-- Emergency Leave Button in Game -->
          <div class="game-actions">
            <button id="emergency-leave-btn" class="party-btn emergency-btn">Emergency Leave</button>
          </div>
        </div>
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

    // Universal Cast/Spectator button - FIX: Better event handling
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      castBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Cast/Spectator button clicked - preventing default and handling manually');
        this.handleCastClick();
      });
    }

    // Back to local button
    const backBtn = document.getElementById('back-to-local-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        console.log('Back to local button clicked');
        this.leaveRoomAndGoLocal();
      });
    }

    // Leave room button
    const leaveBtn = document.getElementById('leave-room-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', () => {
        console.log('Leave room button clicked');
        this.leaveRoom();
      });
    }

    // Emergency leave button
    const emergencyBtn = document.getElementById('emergency-leave-btn');
    if (emergencyBtn) {
      emergencyBtn.addEventListener('click', () => {
        console.log('Emergency leave button clicked');
        this.emergencyLeave();
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

  // Proper room leaving with server notification
  leaveRoom() {
    console.log('🚪 Leaving room...');
    
    if (this.socket && this.isConnected && this.isInRoom) {
      // Notify server we're leaving
      this.socket.emit('leave-room', {
        roomCode: this.roomCode,
        playerName: this.playerName
      });
    }
    
    // Clean up local state
    this.isInRoom = false;
    this.isHost = false;
    this.currentRoom = null;
    this.roomCode = '';
    
    // Show setup form
    this.showSetupForm();
    this.showMessage('Left the room');
  }

  // Leave room and go back to local mode
  leaveRoomAndGoLocal() {
    console.log('🚪 Leaving room and going to local mode...');
    this.leaveRoom();
    this.showLocalMode();
    this.cleanup();
  }

  // Emergency leave during game
  emergencyLeave() {
    console.log('🚨 Emergency leave during game...');
    this.leaveRoomAndGoLocal();
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
    this.roomCode = roomCode; // Store for potential reconnection
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
    
    // Send update to display (Cast or Spectator)
    this.sendToCastDisplay('game-update', {
      gameState: {
        phase: gameState.phase,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        currentDrawer: gameState.currentDrawer,
        currentDrawerIndex: gameState.currentDrawerIndex
      },
      room: {
        code: this.currentRoom.code,
        players: this.currentRoom.players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost
        }))
      }
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
    
    this.stopAllMusicImmediate();
    
    // Get drawings data
    let drawings = extraData.allDrawings || extraData.drawings || gameState.drawings || [];
    let originalMonster = extraData.originalMonster || gameState.currentMonster;
    
    console.log('📸 Final data to send:');
    console.log('- drawings:', drawings);
    console.log('- drawings length:', drawings?.length || 0);
    console.log('- originalMonster:', originalMonster);
    
    // Only send if different from last sent (prevents accumulation)
    const drawingsStringified = JSON.stringify(drawings);
    if (this.lastSentDrawings !== drawingsStringified) {
      console.log('📤 Sending new drawings to display...');
      this.lastSentDrawings = drawingsStringified;
      
      // Send drawings to display (Cast or Spectator)
      this.sendToCastDisplay('show-drawings-slideshow', {
        drawings: drawings,
        originalMonster: originalMonster
      });
    } else {
      console.log('📤 Skipping duplicate drawings send');
    }
    
    this.showWaitingArea('Round Complete!', 'Check the display to see all the drawings!');
    
    // Show next round button for host
    if (this.isHost) {
      this.showNextRoundButton(gameState);
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
          
          :root {
            --vh: 1vh;
            --actual-vh: 100vh;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            overflow: hidden;
            height: var(--actual-vh);
            height: 100vh;
            height: calc(var(--vh, 1vh) * 100);
            width: 100vw;
            position: fixed;
            top: 0;
            left: 0;
            /* iOS optimizations */
            -webkit-overflow-scrolling: touch;
          }
          
          .drawing-interface {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
          }
          
          .drawing-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 2rem;
            backdrop-filter: blur(10px);
            color: white;
            flex-shrink: 0;
            min-height: 70px;
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
            overflow: hidden;
          }
          
          #drawing-canvas {
            border: 4px solid white;
            border-radius: 20px;
            background: white;
            cursor: crosshair;
            touch-action: none;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            display: block;
            /* iOS optimization */
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
          }
          
          .drawing-controls {
            background: rgba(0, 0, 0, 0.9);
            backdrop-filter: blur(10px);
            padding: 1.5rem 1rem;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 0.75rem;
            width: 100%;
            position: relative;
            bottom: 0;
            min-height: 120px;
            /* iOS safe area */
            padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
          }
          
          .color-size-controls {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            flex-wrap: wrap;
            justify-content: center;
          }
          
          .action-controls {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
            flex-wrap: wrap;
          }
          
          #brush-color {
            width: 45px;
            height: 45px;
            border: 3px solid white;
            border-radius: 12px;
            cursor: pointer;
            background: none;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
          }
          
          #brush-size {
            width: 100px;
            height: 6px;
            -webkit-appearance: none;
            background: rgba(255,255,255,0.3);
            border-radius: 5px;
            outline: none;
          }
          
          #brush-size::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: white;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          }
          
          #brush-preview {
            background: #000;
            border: 2px solid white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          }
          
          .control-btn {
            background: white;
            color: #333;
            border: none;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            cursor: pointer;
            font-size: 1.1rem;
            font-weight: bold;
            transition: all 0.3s ease;
            min-width: 140px;
            min-height: 50px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            text-align: center;
            /* iOS optimization */
            -webkit-tap-highlight-color: rgba(0,0,0,0);
          }
          
          .control-btn:hover:not(:disabled) {
            background: #f0f0f0;
            transform: translateY(-2px);
            box-shadow: 0 6px 25px rgba(0,0,0,0.4);
          }
          
          .control-btn:active {
            transform: translateY(0);
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
            font-size: 1.2rem;
            min-width: 160px;
            min-height: 55px;
            padding: 1.1rem 1.75rem;
          }
          
          .control-btn.submit-btn:hover:not(:disabled) {
            background: #229954;
            box-shadow: 0 6px 30px rgba(39, 174, 96, 0.4);
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
          
          /* Enhanced iOS optimizations */
          @media (max-width: 768px) {
            .drawing-header {
              padding: 0.75rem 1rem;
              min-height: 60px;
            }
            
            .drawing-title {
              font-size: 1.3rem;
            }
            
            .drawing-timer {
              font-size: 1.3rem;
              padding: 0.6rem 1.2rem;
              min-width: 100px;
            }
            
            .canvas-container {
              padding: 0.75rem;
            }
            
            .drawing-controls {
              padding: 1.25rem 0.75rem max(1.25rem, env(safe-area-inset-bottom));
              gap: 1rem;
              min-height: 140px;
            }
            
            .control-btn {
              padding: 1rem 1.25rem;
              font-size: 1.05rem;
              min-width: 120px;
              min-height: 50px;
            }
          }
          
          /* iOS-specific optimizations */
          @supports (-webkit-appearance: none) {
            .drawing-interface {
              height: -webkit-fill-available;
            }
            
            .canvas-container {
              /* Ensure canvas doesn't interfere with iOS gestures */
              padding: 1rem;
              margin: 0;
            }
            
            #drawing-canvas {
              /* Prevent iOS zoom on double-tap */
              touch-action: manipulation;
            }
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
            <div class="action-controls">
              <button id="clear-btn" class="control-btn clear-btn">Clear</button>
              <button id="submit-btn" class="control-btn submit-btn">Submit</button>
            </div>
            
            <div class="color-size-controls">
              <input type="color" id="brush-color" value="#000000">
              <input type="range" id="brush-size" min="1" max="30" value="5">
              <div id="brush-preview"></div>
            </div>
          </div>
        </div>
        
        <script>
          // Enhanced iOS support
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          
          // Set CSS custom property for actual viewport height (iOS fix)
          function setVH() {
            let vh = window.innerHeight * 0.01;
            document.documentElement.style.setProperty('--vh', vh + 'px');
            document.documentElement.style.setProperty('--actual-vh', window.innerHeight + 'px');
          }
          
          setVH();
          window.addEventListener('resize', setVH);
          window.addEventListener('orientationchange', () => {
            setTimeout(setVH, 100);
          });
          
          class DrawingInterface {
            constructor() {
              this.canvas = document.getElementById('drawing-canvas');
              this.ctx = this.canvas.getContext('2d');
              this.isDrawing = false;
              this.lastX = 0;
              this.lastY = 0;
              this.isIOS = isIOS;
              
              this.init();
            }
            
            init() {
              this.setupCanvas();
              this.setupEventListeners();
              this.updateBrushPreview();
              
              // iOS-specific initialization
              if (this.isIOS) {
                this.setupIOSOptimizations();
              }
            }
            
            setupIOSOptimizations() {
              // Prevent iOS zoom
              document.addEventListener('touchmove', (e) => {
                if (e.scale !== 1) {
                  e.preventDefault();
                }
              }, { passive: false });
              
              // Prevent iOS bounce scrolling
              document.body.addEventListener('touchmove', (e) => {
                e.preventDefault();
              }, { passive: false });
            }
            
            setupCanvas() {
              this.resizeCanvas();
              
              this.ctx.lineCap = 'round';
              this.ctx.lineJoin = 'round';
              this.ctx.lineWidth = 5;
              this.ctx.strokeStyle = '#000000';
              
              // iOS Canvas optimizations
              if (this.isIOS) {
                this.ctx.imageSmoothingEnabled = true;
                this.ctx.imageSmoothingQuality = 'high';
              }
            }
            
            resizeCanvas() {
              const container = this.canvas.parentElement;
              const containerRect = container.getBoundingClientRect();
              
              const maxSize = Math.min(containerRect.width - 20, containerRect.height - 20, 600);
              
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
              // Enhanced touch support for iOS
              this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
              this.canvas.addEventListener('mousemove', (e) => this.draw(e));
              this.canvas.addEventListener('mouseup', () => this.stopDrawing());
              this.canvas.addEventListener('mouseout', () => this.stopDrawing());
              
              // Better touch handling for iOS
              this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startDrawing(e);
              }, { passive: false });
              
              this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                this.draw(e);
              }, { passive: false });
              
              this.canvas.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopDrawing();
              }, { passive: false });
              
              this.canvas.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.stopDrawing();
              }, { passive: false });
              
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
              
              window.addEventListener('orientationchange', () => {
                setTimeout(() => this.resizeCanvas(), 100);
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
              preview.style.width = Math.max(10, Math.min(30, size)) + 'px';
              preview.style.height = Math.max(10, Math.min(30, size)) + 'px';
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
    
    // Remove any existing host controls first
    const existingControls = waitingArea.querySelector('.waiting-host-controls');
    if (existingControls) {
      existingControls.remove();
    }
    
    // Always show both buttons - no max rounds, game continues until host chooses to finish
    const buttonHtml = `
      <div class="waiting-host-controls">
        <button id="next-round-waiting-btn" class="party-btn next-btn">
          Next Round
        </button>
        <button id="finish-game-waiting-btn" class="party-btn finish-btn">
          Finish Game
        </button>
      </div>
    `;
    
    waitingArea.innerHTML += buttonHtml;
    
    const nextRoundBtn = document.getElementById('next-round-waiting-btn');
    const finishGameBtn = document.getElementById('finish-game-waiting-btn');
    
    if (nextRoundBtn) {
      nextRoundBtn.addEventListener('click', () => {
        // Clear the last sent drawings to reset state
        this.lastSentDrawings = null;
        this.socket.emit('next-round');
      });
    }
    
    if (finishGameBtn) {
      finishGameBtn.addEventListener('click', () => {
        this.socket.emit('finish-game');
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
    
    // Send to display (Cast or Spectator)
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
    // Send to display (Cast or Spectator)
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
    
    // Send to display (Cast or Spectator)
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

  cleanup() {
    console.log('🧹 Cleaning up party mode...');
    
    // Set flag to prevent reconnection attempts during cleanup
    this.forceDisconnectOnCleanup = true;
    
    // Stop all audio
    this.stopAllMusicImmediate();
    this.currentMusicPhase = null;
    
    // Clear timers and intervals
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Cleanup cast manager
    if (this.castManager) {
      this.castManager.cleanup();
    }
    
    // Close spectator window
    if (this.spectatorWindow && !this.spectatorWindow.closed) {
      this.spectatorWindow.close();
      this.spectatorWindow = null;
    }
    
    // Hide drawing overlay
    this.hideDrawingOverlay();
    
    // Properly disconnect from room and socket
    if (this.socket && this.isConnected) {
      console.log('🔌 Disconnecting from server...');
      
      // Send leave room event if we're in a room
      if (this.isInRoom && this.roomCode) {
        this.socket.emit('leave-room', {
          roomCode: this.roomCode,
          playerName: this.playerName
        });
      }
      
      // Force disconnect
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Reset all state variables
    this.isConnected = false;
    this.isInRoom = false;
    this.playerName = '';
    this.roomCode = '';
    this.isHost = false;
    this.currentRoom = null;
    this.lastSentDrawings = null;
    this.connectionAttempts = 0;
    
    // Reset UI
    this.updateConnectionStatus('Not Connected');
    
    // Reset cast/spectator button
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn && this.castManager) {
      this.castManager.updateCastButton('ready');
    }
    
    // Remove event listeners
    this.removeVisibilityHandlers();
    
    console.log('✅ Party mode cleanup complete');
  }

  // Remove visibility handlers
  removeVisibilityHandlers() {
    if (this.visibilityChangeHandler) {
      document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
      this.visibilityChangeHandler = null;
    }
    
    if (this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      this.pageHideHandler = null;
    }
    
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
  }
}

// Universal Cast Manager - YouTube/Netflix Style
class UniversalCastManager {
constructor(partyClient) {
  this.partyClient = partyClient;
  this.castSession = null;
  this.APPLICATION_ID = '570D13B8';
  this.useDefaultReceiver = false;
  
  // FIXED: Better device detection
  this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  this.isChrome = /Chrome|CriOS/.test(navigator.userAgent); // Include Chrome on iOS!
  this.isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS/.test(navigator.userAgent);
  this.isIOSSafari = this.isIOS && this.isSafari;
  this.isChromeOnIOS = this.isIOS && /CriOS/.test(navigator.userAgent);
  
  // FIXED: Better capability detection
  this.canUseCastSDK = this.isChrome; // Chrome on ANY platform (including iOS)
  this.shouldUseAirPlay = this.isIOS && !this.isChrome; // iOS Safari only
  this.canCast = this.canUseCastSDK || this.shouldUseAirPlay || true; // Always allow attempts
  
  console.log('🎯 Universal Cast Manager - Capabilities:', {
    isIOS: this.isIOS,
    isChrome: this.isChrome,
    isSafari: this.isSafari,
    isIOSSafari: this.isIOSSafari,
    isChromeOnIOS: this.isChromeOnIOS,
    canUseCastSDK: this.canUseCastSDK,
    shouldUseAirPlay: this.shouldUseAirPlay,
    canCast: this.canCast,
    userAgent: navigator.userAgent
  });
  
  this.init();
}

  init() {
    if (this.canUseCastSDK) {
      // Initialize Google Cast SDK (works on Chrome including iOS)
      this.initializeGoogleCast();
    } else if (this.shouldUseAirPlay) {
      // iOS Safari - prepare for AirPlay
      this.initializeAirPlay();
    } else {
      // Other browsers - show guidance
      this.initializeFallback();
    }
  }

  initializeGoogleCast() {
    console.log('📡 Initializing Google Cast SDK...');
    if (!window.chrome || !window.chrome.cast) {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
      script.onload = () => this.setupGoogleCast();
      script.onerror = () => {
        console.error('Failed to load Cast SDK');
        this.updateCastButton('not-supported');
      };
      document.head.appendChild(script);
    } else {
      this.setupGoogleCast();
    }
  }

  setupGoogleCast() {
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
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
          console.log('✅ Google Cast SDK initialized');
        } catch (error) {
          console.error('Cast init failed:', error);
          this.updateCastButton('not-supported');
        }
      } else {
        console.error('Cast API not available');
        this.updateCastButton('not-supported');
      }
    };
  }

  initializeAirPlay() {
    console.log('🍎 Initializing AirPlay support...');
    this.updateCastButton('airplay-ready');
  }

  initializeFallback() {
    console.log('⚠️ Initializing fallback mode...');
    this.updateCastButton('not-supported');
  }

  // Universal cast button click handler (YouTube-style)
  handleCastClick() {
    console.log('🎯 Universal cast click handler');
    
    if (this.canUseCastSDK) {
      // Use Google Cast SDK (Chrome on any platform)
      this.handleGoogleCast();
    } else if (this.shouldUseAirPlay) {
      // Use iOS native AirPlay (Safari on iOS)
      this.handleNativeAirPlay();
    } else {
      // Show browser guidance
      this.showBrowserGuidance();
    }
  }

  handleGoogleCast() {
    console.log('📡 Handling Google Cast...');
    try {
      const castContext = cast.framework.CastContext.getInstance();
      
      if (this.castSession) {
        // Already connected - show message
        this.partyClient.showMessage('Already connected to Chromecast. Game is displaying on TV.');
      } else {
        // Request new session
        castContext.requestSession()
          .then(() => {
            console.log('✅ Cast session started');
          })
          .catch((error) => {
            if (error.code !== 'cancel') {
              console.error('Cast error:', error);
              this.partyClient.showError('Failed to connect to Chromecast. Make sure you\'re on the same WiFi network.');
            }
          });
      }
    } catch (error) {
      console.error('Cast click error:', error);
      this.partyClient.showError('Cast not available. Please refresh and try again.');
    }
  }

  handleNativeAirPlay() {
    console.log('🍎 Handling native AirPlay...');
    
    // Check for modern presentation API
    if ('webkitPresentationMode' in HTMLVideoElement.prototype || 
        navigator.mediaDevices?.getDisplayMedia) {
      this.createAirPlayVideo();
    } else {
      // Fallback: open fullscreen view and instruct user
      this.createAirPlayFallback();
    }
  }

  createAirPlayVideo() {
    console.log('📺 Creating AirPlay video element...');
    
    // Create video element for AirPlay (like YouTube does)
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = false; // Important for AirPlay
    video.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 10000;
      width: 80vw;
      height: 45vw;
      max-width: 800px;
      max-height: 450px;
      background: black;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;

    // Create a canvas stream for the game
    const canvas = this.createGameCanvas();
    const stream = canvas.captureStream(30);
    video.srcObject = stream;

    // Add to page
    document.body.appendChild(video);
    
    // Auto-play and trigger AirPlay picker
    video.play().then(() => {
      if ('webkitShowPlaybackTargetPicker' in video) {
        // Trigger AirPlay picker automatically
        video.webkitShowPlaybackTargetPicker();
      }
      this.partyClient.showMessage('Video created! Use AirPlay button or Control Center → Screen Mirroring to cast to Apple TV');
    }).catch((error) => {
      console.error('Video play failed:', error);
      this.partyClient.showError('Failed to start video for AirPlay');
    });

    // Store references
    this.airPlayVideo = video;
    this.airPlayCanvas = canvas;

    // Add close button
    this.createAirPlayCloseButton(video);
  }

  createAirPlayCloseButton(video) {
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
      position: fixed;
      top: calc(50% - 45vw/2 - 15px);
      right: calc(50% - 80vw/2 - 15px);
      background: rgba(0,0,0,0.8);
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    closeBtn.onclick = () => {
      video.remove();
      closeBtn.remove();
      this.cleanupAirPlay();
    };

    document.body.appendChild(closeBtn);
  }

  createAirPlayFallback() {
    console.log('🍎 Creating AirPlay fallback...');
    
    // Simple fallback - open game view in new window
    const castWindow = window.open(
      'viewer.html?airplay=true', 
      'GameCast', 
      'width=1280,height=720,scrollbars=no,resizable=yes'
    );

    if (castWindow) {
      this.partyClient.showMessage('Game view opened! Use Control Center → Screen Mirroring to cast to Apple TV');
    } else {
      this.partyClient.showError('Please allow popups and try again');
    }
  }

  createGameCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    // Start rendering game to canvas
    this.renderGameToCanvas(ctx, canvas);
    
    return canvas;
  }

  renderGameToCanvas(ctx, canvas) {
    // Clear with game background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Game title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Drawblins Party', canvas.width / 2, 100);

    // Room code
    if (this.partyClient.roomCode) {
      ctx.font = '36px Arial';
      ctx.fillText(`Room: ${this.partyClient.roomCode}`, canvas.width / 2, 160);
    }

    // Game status
    if (this.partyClient.currentRoom) {
      ctx.font = '24px Arial';
      ctx.textAlign = 'left';
      
      let y = 250;
      ctx.fillText('Players:', 100, y);
      y += 40;
      
      this.partyClient.currentRoom.players?.forEach((player, index) => {
        ctx.fillText(`${index + 1}. ${player.name} ${player.isHost ? '(Host)' : ''}`, 120, y);
        y += 35;
      });
    }

    // Continue animation loop
    requestAnimationFrame(() => this.renderGameToCanvas(ctx, canvas));
  }

  showBrowserGuidance() {
    console.log('ℹ️ Showing browser guidance...');
    
    if (this.isIOSSafari) {
      this.partyClient.showMessage('💡 For Chromecast: Use Chrome browser app. For Apple TV: Use Control Center → Screen Mirroring');
    } else {
      this.partyClient.showError('For casting, please use Chrome browser or Safari on iOS');
    }
  }

  // Cast state change handler (Google Cast)
  onCastStateChanged(event) {
    console.log('📡 Cast state changed:', event.castState);
    
    switch (event.castState) {
      case cast.framework.CastState.CONNECTED:
        this.castSession = cast.framework.CastContext.getInstance().getCurrentSession();
        this.updateCastButton('connected');
        this.partyClient.showMessage('✅ Connected to Chromecast! Game will display on TV.');
        this.sendInitialGameData();
        break;
        
      case cast.framework.CastState.CONNECTING:
        this.updateCastButton('connecting');
        break;
        
      case cast.framework.CastState.NOT_CONNECTED:
        this.castSession = null;
        this.updateCastButton('ready');
        break;
    }
  }

  // Update cast button based on state (universal)
  updateCastButton(state) {
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (!castBtn) return;

    // Reset classes
    castBtn.classList.remove('connected', 'connecting');

    switch (state) {
      case 'ready':
        // Google Cast ready (Chrome)
        castBtn.innerHTML = '📺 Cast';
        castBtn.disabled = false;
        castBtn.title = 'Cast to Chromecast';
        break;
        
      case 'airplay-ready':
        // iOS Safari - AirPlay ready
        castBtn.innerHTML = '📺 Cast';
        castBtn.disabled = false;
        castBtn.title = 'Cast to Apple TV';
        break;
        
      case 'connecting':
        castBtn.innerHTML = '📺 Connecting...';
        castBtn.disabled = true;
        castBtn.classList.add('connecting');
        break;
        
      case 'connected':
        castBtn.innerHTML = '📺 Connected';
        castBtn.disabled = false;
        castBtn.classList.add('connected');
        castBtn.title = 'Game is displaying on TV';
        break;
        
      case 'not-supported':
        castBtn.innerHTML = '📺 Cast';
        castBtn.disabled = true;
        castBtn.title = 'Use Chrome or Safari on iOS for casting';
        break;
    }
  }

  // Send initial game data to cast display
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

  // Universal send to cast method
  sendToCast(type, data) {
    console.log('📤 Universal sendToCast:', type);
    
    if (this.canUseCastSDK && this.castSession) {
      // Send to Google Cast
      if (type === 'show-drawings-slideshow') {
        this.sendDrawingsSlideshowData(data);
      } else {
        this.sendMessage(type, data);
      }
    } else if (this.airPlayCanvas) {
      // Update AirPlay canvas
      this.updateAirPlayCanvas(type, data);
    }
  }

  // Send message to Google Cast
  sendMessage(type, data) {
    if (!this.castSession) {
      console.error('❌ No cast session available');
      return;
    }

    try {
      const message = { type, ...data };
      const messageSize = JSON.stringify(message).length;
      
      console.log('📡 Sending to Google Cast:', type, 'Size:', messageSize);
      
      // Size limit for Cast
      if (messageSize > 30000) {
        console.error('❌ Message too large for Cast:', messageSize);
        this.partyClient.showError(`Message too large for Cast: ${messageSize} characters`);
        return;
      }
      
      this.castSession.sendMessage(
        'urn:x-cast:com.drawblins.gamedata',
        message
      ).then(() => {
        console.log('✅ Cast message sent:', type);
      }).catch((error) => {
        console.error('❌ Cast message error:', error);
        if (error === 'invalid_parameter') {
          this.partyClient.showError('Message too large for Cast TV');
        }
      });
    } catch (error) {
      console.error('❌ Send message error:', error);
    }
  }

  // Send drawings slideshow to Google Cast
  async sendDrawingsSlideshowData(data) {
    console.log('🎨 Sending drawings slideshow to Cast...');
    
    try {
      // Send original monster first
      if (data.originalMonster) {
        this.sendMessage('slideshow-start', {
          originalMonster: data.originalMonster,
          totalDrawings: data.drawings?.length || 0
        });
      }

      // Send compressed drawings one by one
      if (data.drawings && data.drawings.length > 0) {
        for (let i = 0; i < data.drawings.length; i++) {
          const drawing = data.drawings[i];
          console.log(`📤 Processing drawing ${i + 1}/${data.drawings.length}`);
          
          if (drawing.imageData) {
            try {
              // Compress for Cast
              const compressedImage = await this.compressImageData(drawing.imageData, 0.3);
              
              this.sendMessage('slideshow-drawing', {
                playerName: drawing.playerName,
                imageData: compressedImage,
                autoSubmitted: drawing.autoSubmitted,
                index: i,
                isLast: i === data.drawings.length - 1
              });
              
              // Small delay between drawings
              await new Promise(resolve => setTimeout(resolve, 200));
              
            } catch (error) {
              console.error('Error processing drawing:', error);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending slideshow data:', error);
    }
  }

  // Ultra-aggressive image compression for Cast
  async compressImageData(imageData, quality = 0.4) {
    return new Promise((resolve) => {
      console.log('🗜️ Compressing image...');
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Smaller size for TV display
        const maxSize = 300;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        // Fill with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        try {
          const compressedData = canvas.toDataURL('image/jpeg', quality);
          console.log('🗜️ Compressed:', Math.round(compressedData.length/imageData.length*100) + '%');
          resolve(compressedData);
        } catch (error) {
          console.error('Compression failed:', error);
          resolve(imageData);
        }
      };
      
      img.onerror = (error) => {
        console.error('Failed to load image for compression:', error);
        resolve(imageData);
      };
      
      img.src = imageData;
    });
  }

  // Update AirPlay canvas with game data
  updateAirPlayCanvas(type, data) {
    if (!this.airPlayCanvas) return;

    const ctx = this.airPlayCanvas.getContext('2d');
    
    switch (type) {
      case 'game-update':
        this.renderGameUpdate(ctx, data);
        break;
      case 'show-drawings-slideshow':
        this.renderDrawingsSlideshow(ctx, data);
        break;
      case 'timer-update':
        this.renderTimer(ctx, data);
        break;
    }
  }

  renderGameUpdate(ctx, data) {
    // This will be handled by the continuous renderGameToCanvas loop
    // Just store the data for the next render
    this.gameUpdateData = data;
  }

  renderDrawingsSlideshow(ctx, data) {
    // For AirPlay, we could implement a slideshow here
    // For now, just indicate that drawings are being shown
    if (data.drawings && data.drawings.length > 0) {
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, this.airPlayCanvas.width, this.airPlayCanvas.height);
      
      ctx.fillStyle = 'white';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Drawings Complete!', this.airPlayCanvas.width / 2, this.airPlayCanvas.height / 2);
      
      ctx.font = '32px Arial';
      ctx.fillText(`${data.drawings.length} drawings submitted`, this.airPlayCanvas.width / 2, this.airPlayCanvas.height / 2 + 60);
    }
  }

  renderTimer(ctx, data) {
    // Timer will be rendered as part of the game state in renderGameToCanvas
    this.timerData = data;
  }

  // Cleanup methods
  cleanupAirPlay() {
    if (this.airPlayVideo) {
      this.airPlayVideo.remove();
      this.airPlayVideo = null;
    }
    
    if (this.airPlayCanvas) {
      this.airPlayCanvas = null;
    }
  }

  cleanup() {
    console.log('🧹 Cleaning up Universal Cast Manager...');
    
    // Cleanup Google Cast
    if (this.castSession) {
      try {
        this.castSession.endSession(false);
      } catch (error) {
        console.log('Error ending cast session:', error);
      }
      this.castSession = null;
    }

    // Cleanup AirPlay
    this.cleanupAirPlay();

    // Reset cast button
    const castBtn = document.getElementById('cast-to-tv-btn');
    if (castBtn) {
      castBtn.classList.remove('connected', 'connecting');
      if (this.canCast) {
        castBtn.innerHTML = '📺 Cast';
        castBtn.disabled = false;
      } else {
        castBtn.innerHTML = '📺 Cast';
        castBtn.disabled = true;
      }
    }
    
    console.log('✅ Universal Cast Manager cleanup complete');
  }
}

// Initialize party mode when DOM is loaded
let partyClient = null;

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing enhanced party client...');
  if (window.self === window.top) {
    partyClient = new PartyGameClient();
    
    // FIXED: Make partyClient available globally IMMEDIATELY
    window.partyClient = partyClient;
    
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

// ALSO set a backup global reference
window.getPartyClient = function() {
  return partyClient;
};