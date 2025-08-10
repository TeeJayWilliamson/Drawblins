const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configure CORS for Socket.io
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || ["http://localhost:3000", "https://your-frontend-domain.com"],
    methods: ["GET", "POST"],
    credentials: true
  },
  // Enhanced connection settings for iOS support
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());

// Game state storage (in production, consider Redis)
const rooms = new Map();
const players = new Map(); // socketId -> playerInfo

// Monster list (1-266)
const totalMonsters = 266;
const getRandomMonster = () => `monster${Math.floor(Math.random() * totalMonsters) + 1}.png`;

// Difficulty ranges
const difficultyRanges = {
  easy: { min: 1, max: 158 },
  standard: { min: 159, max: 266 },
  all: { min: 1, max: 266 }
};

// Utility functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomMonsterByDifficulty(difficulty = 'standard') {
  const range = difficultyRanges[difficulty] || difficultyRanges.standard;
  const monsterNum = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  return `monster${monsterNum}.png`;
}

function createRoom(hostId, hostName) {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room = {
    code: roomCode,
    hostId: hostId,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      isReady: false
    }],
    gameState: {
      phase: 'lobby', // lobby, studying, drawing, reveal, finished
      currentDrawer: null,
      currentDrawerIndex: 0, // FIXED: Start at 0 instead of undefined
      currentRound: 1,
      maxRounds: 5,
      viewTime: 20,
      drawTime: 120, // 2 minutes in seconds
      currentMonster: null,
      drawings: [], // {playerId, playerName, imageData, submittedAt}
      timer: 0,
      usedMonsters: [],
      difficulty: 'standard',
      timerInterval: null
    },
    createdAt: Date.now(),
    lastActivity: Date.now() // Track room activity for cleanup
  };

  rooms.set(roomCode, room);
  console.log(`✅ Room ${roomCode} created by ${hostName} (${hostId.substring(0, 8)})`);
  return room;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function getPlayerRoom(playerId) {
  for (const [roomCode, room] of rooms.entries()) {
    if (room.players.find(p => p.id === playerId)) {
      return { roomCode, room };
    }
  }
  return null;
}

// Enhanced room cleanup with proper timer handling
function removePlayerFromRoom(playerId, playerName = 'Unknown', isExplicitLeave = false) {
  const playerRoom = getPlayerRoom(playerId);
  if (!playerRoom) {
    console.log(`🚫 Player ${playerName} (${playerId.substring(0, 8)}) not found in any room`);
    return null;
  }

  const { roomCode, room } = playerRoom;
  
  // Store original host status and remaining players before modification
  const wasHost = room.hostId === playerId;
  const remainingPlayers = room.players.filter(p => p.id !== playerId);
  
  // Remove player from room
  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    room.players.splice(playerIndex, 1);
    console.log(`🚪 Player ${playerName} (${playerId.substring(0, 8)}) left room ${roomCode}`);
  }

  // Update room activity
  room.lastActivity = Date.now();

  // If host left, handle host departure scenarios
  if (wasHost) {
    if (remainingPlayers.length > 0) {
      // OPTION 1: If you want to kick everyone when host leaves (emergency leave behavior)
      if (isExplicitLeave) {
        console.log(`👑 Host ${playerName} left room ${roomCode}, kicking all remaining players`);
        
        // Notify all remaining players that host left and they're being kicked
        io.to(roomCode).emit('host-left-room-closed', {
          message: 'Host left the game. Returning to main menu.',
          hostName: playerName
        });
        
        // Clean up and delete room
        cleanupRoom(room, roomCode);
        rooms.delete(roomCode);
        
        // Remove all remaining players from players map
        remainingPlayers.forEach(player => {
          players.delete(player.id);
        });
        
        return { roomCode, deleted: true, kickedPlayers: remainingPlayers };
      } else {
        // OPTION 2: Transfer host to first remaining player (for disconnections)
        room.hostId = remainingPlayers[0].id;
        room.players.find(p => p.id === remainingPlayers[0].id).isHost = true;
        console.log(`👑 Host transferred to ${remainingPlayers[0].name} (${remainingPlayers[0].id.substring(0, 8)}) in room ${roomCode}`);
      }
    } else {
      // No players left, clean up and delete room
      console.log(`🗑️ Room ${roomCode} is empty, cleaning up...`);
      cleanupRoom(room, roomCode);
      rooms.delete(roomCode);
      return { roomCode, deleted: true };
    }
  }

  return { roomCode, room, leftPlayerName: playerName, wasHost };
}

// Clean up room resources
function cleanupRoom(room, roomCode) {
  console.log(`🧹 Cleaning up room ${roomCode}...`);
  
  // Clear any active timer
  if (room.gameState.timerInterval) {
    clearInterval(room.gameState.timerInterval);
    room.gameState.timerInterval = null;
    console.log(`⏰ Timer cleared for room ${roomCode}`);
  }
  
  // Clear any other room-specific resources
  room.gameState.drawings = [];
  room.gameState.usedMonsters = [];
  
  console.log(`✅ Room ${roomCode} cleanup complete`);
}

// FIXED: Proper drawer selection logic
function selectNextDrawer(room) {
  if (room.players.length === 0) return null;
  
  // Get the current drawer index, ensuring it's within bounds
  let currentIndex = room.gameState.currentDrawerIndex || 0;
  
  // Ensure index is within current player count
  if (currentIndex >= room.players.length) {
    currentIndex = 0;
    room.gameState.currentDrawerIndex = 0;
  }
  
  // Select the player at the current index
  const selectedPlayer = room.players[currentIndex];
  
  console.log(`🎯 Selecting drawer: index ${currentIndex}, player: ${selectedPlayer?.name} (ID: ${selectedPlayer?.id.substring(0, 8)})`);
  
  return selectedPlayer ? selectedPlayer.id : null;
}

function startGameTimer(room, roomCode, duration, phase, onComplete) {
  // Clear any existing timer
  if (room.gameState.timerInterval) {
    clearInterval(room.gameState.timerInterval);
  }

  room.gameState.timer = duration;
  
  // Send initial timer
  io.to(roomCode).emit('timer-update', {
    timeLeft: room.gameState.timer,
    phase: phase
  });
  
  room.gameState.timerInterval = setInterval(() => {
    room.gameState.timer--;
    
    // Send timer updates more frequently for better UX
    io.to(roomCode).emit('timer-update', {
      timeLeft: room.gameState.timer,
      phase: phase
    });
    
    // Phase complete
    if (room.gameState.timer <= 0) {
      clearInterval(room.gameState.timerInterval);
      room.gameState.timerInterval = null;
      onComplete();
    }
  }, 1000);
  
  return room.gameState.timerInterval;
}

function checkAllPlayersSubmitted(room) {
  const expectedSubmissions = room.players.filter(p => p.id !== room.gameState.currentDrawer).length;
  return room.gameState.drawings.length >= expectedSubmissions;
}

function autoSubmitMissingDrawings(room, roomCode) {
  const submittedPlayerIds = room.gameState.drawings.map(d => d.playerId);
  const missingPlayers = room.players.filter(p => 
    p.id !== room.gameState.currentDrawer && 
    !submittedPlayerIds.includes(p.id)
  );

  missingPlayers.forEach(player => {
    // Request auto-submit from each missing player
    io.to(player.id).emit('auto-submit-drawing', {
      timeUp: true
    });
  });
}

// Periodic cleanup of inactive rooms
setInterval(() => {
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomCode, room] of rooms.entries()) {
    if (now - room.lastActivity > inactiveThreshold) {
      console.log(`🗑️ Cleaning up inactive room ${roomCode} (inactive for ${Math.round((now - room.lastActivity) / 60000)} minutes)`);
      cleanupRoom(room, roomCode);
      rooms.delete(roomCode);
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id.substring(0, 8)}...`);
  
  // Handle iOS heartbeat to keep connections alive
  socket.on('heartbeat', () => {
    // Just acknowledge the heartbeat - socket.io handles the rest
    socket.emit('heartbeat-ack');
  });

  // Create a new room
  socket.on('create-room', (data) => {
    const { playerName } = data;
    
    try {
      const room = createRoom(socket.id, playerName);
      
      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomCode: room.code,
        joinedAt: Date.now()
      });

      socket.join(room.code);
      
      socket.emit('room-created', {
        success: true,
        roomCode: room.code,
        room: room
      });

      console.log(`✅ Room ${room.code} created by ${playerName} (${socket.id.substring(0, 8)})`);
    } catch (error) {
      console.error('❌ Error creating room:', error);
      socket.emit('room-created', {
        success: false,
        error: 'Failed to create room'
      });
    }
  });

  // Join existing room with enhanced handling
  socket.on('join-room', (data) => {
    const { roomCode, playerName, isViewer, reconnecting } = data;
    
    try {
      const room = getRoom(roomCode);
      
      if (!room) {
        socket.emit('room-joined', {
          success: false,
          error: 'Room not found'
        });
        return;
      }

      // Update room activity
      room.lastActivity = Date.now();

      // Handle viewers differently (spectators, etc.)
      if (isViewer || playerName.includes('Web Viewer')) {
        socket.join(roomCode);
        socket.isViewer = true;
        socket.emit('room-joined', { 
          success: true, 
          room: {
            code: room.code,
            players: room.players,
            gameState: room.gameState
          }
        });
        console.log(`👁️ Viewer "${playerName}" joined room ${roomCode} (not counted as player)`);
        return;
      }

      // Handle reconnecting players
      if (reconnecting) {
        const existingPlayer = room.players.find(p => p.name === playerName);
        if (existingPlayer) {
          // Update the player's socket ID
          existingPlayer.id = socket.id;
          players.set(socket.id, {
            id: socket.id,
            name: playerName,
            roomCode: roomCode,
            joinedAt: Date.now()
          });
          
          socket.join(roomCode);
          
          socket.emit('room-joined', {
            success: true,
            room: room
          });
          
          console.log(`🔄 Player ${playerName} reconnected to room ${roomCode}`);
          return;
        }
      }

      // Check if player name already exists (for new joins)
      if (room.players.find(p => p.name === playerName)) {
        socket.emit('room-joined', {
          success: false,
          error: 'Player name already taken'
        });
        return;
      }

      // Check room capacity (max 8 players, viewers don't count)
      if (room.players.length >= 8) {
        socket.emit('room-joined', {
          success: false,
          error: 'Room is full'
        });
        return;
      }

      // Add new player to room
      const newPlayer = {
        id: socket.id,
        name: playerName,
        isHost: false,
        isReady: false
      };

      room.players.push(newPlayer);
      
      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomCode: roomCode,
        joinedAt: Date.now()
      });

      socket.join(roomCode);

      // Notify everyone in the room
      socket.emit('room-joined', {
        success: true,
        room: room
      });

      socket.to(roomCode).emit('player-joined', {
        player: newPlayer,
        room: room
      });

      console.log(`✅ ${playerName} joined room ${roomCode} (${socket.id.substring(0, 8)})`);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      socket.emit('room-joined', {
        success: false,
        error: 'Failed to join room'
      });
    }
  });

  // Handle explicit room leaving
  socket.on('leave-room', (data) => {
    const { roomCode, playerName } = data;
    
    console.log(`🚪 Player ${playerName} explicitly leaving room ${roomCode}`);
    
    const result = removePlayerFromRoom(socket.id, playerName, true);
    if (result) {
      if (result.deleted) {
        // Room was deleted (host left or no players remaining)
        console.log(`🗑️ Room ${roomCode} deleted after ${playerName} left`);
        
        if (result.kickedPlayers) {
          console.log(`👑 ${result.kickedPlayers.length} players were kicked when host left`);
        }
      } else if (result.room) {
        // Notify remaining players (non-host left)
        socket.to(roomCode).emit('player-left', {
          room: result.room,
          leftPlayerId: socket.id,
          leftPlayerName: playerName
        });
        
        console.log(`📢 Notified remaining players in ${roomCode} about ${playerName} leaving`);
      }
    }
    
    // Remove from players map
    players.delete(socket.id);
    
    // Leave the socket room
    socket.leave(roomCode);
    
    // Acknowledge the leave
    socket.emit('left-room', {
      success: true,
      message: `Left room ${roomCode}`
    });
  });

  // Start game (only host can do this)
  socket.on('start-game', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Only host can start game
    if (room.hostId !== socket.id) {
      socket.emit('game-error', { error: 'Only host can start the game' });
      return;
    }

    // Need at least 2 players
    if (room.players.length < 2) {
      socket.emit('game-error', { error: 'Need at least 2 players to start' });
      return;
    }

    // Update game settings
    room.gameState.viewTime = data.viewTime || 20;
    room.gameState.drawTime = data.drawTime || 120;
    room.gameState.difficulty = data.difficulty || 'standard';
    room.gameState.maxRounds = data.maxRounds || room.players.length;

    // FIXED: Initialize drawer selection properly
    room.gameState.currentDrawerIndex = 0;
    room.gameState.currentRound = 1;

    // Start first round
    startNextRound(room, roomCode);

    console.log(`🎮 Game started in room ${roomCode} with ${room.players.length} players`);
  });

  function startNextRound(room, roomCode) {
    console.log(`🎯 Starting round ${room.gameState.currentRound} in room ${roomCode}`);
    console.log(`🎯 Current drawer index: ${room.gameState.currentDrawerIndex}`);
    console.log(`🎯 Players in room:`, room.players.map(p => `${p.name} (${p.id.substring(0, 8)})`));
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Select next drawer
    room.gameState.currentDrawer = selectNextDrawer(room);
    
    if (!room.gameState.currentDrawer) {
      console.error('❌ No valid drawer found!');
      io.to(roomCode).emit('game-error', { error: 'No valid drawer found' });
      return;
    }

    const currentDrawerPlayer = room.players.find(p => p.id === room.gameState.currentDrawer);
    console.log(`🎨 Selected drawer: ${currentDrawerPlayer?.name} (${room.gameState.currentDrawer.substring(0, 8)})`);

    // Select monster (avoid repeats)
    let monster;
    do {
      monster = getRandomMonsterByDifficulty(room.gameState.difficulty);
    } while (room.gameState.usedMonsters.includes(monster) && room.gameState.usedMonsters.length < totalMonsters);
    
    room.gameState.currentMonster = monster;
    room.gameState.usedMonsters.push(monster);
    room.gameState.drawings = [];
    room.gameState.phase = 'studying';

    console.log(`👹 Round ${room.gameState.currentRound}: ${currentDrawerPlayer?.name} will draw ${monster}`);

    // Notify all players about game start/round start
    io.to(roomCode).emit('game-started', {
      gameState: room.gameState,
      room: room
    });

    // Send monster only to current drawer
    io.to(room.gameState.currentDrawer).emit('monster-revealed', {
      monster: monster,
      viewTime: room.gameState.viewTime
    });

    console.log(`👹 Monster ${monster} sent to drawer ${currentDrawerPlayer?.name}`);

    // Start studying timer
    startGameTimer(room, roomCode, room.gameState.viewTime, 'studying', () => {
      // Move to drawing phase
      room.gameState.phase = 'drawing';
      
      console.log(`✏️ Moving to drawing phase - Round ${room.gameState.currentRound}`);
      
      io.to(roomCode).emit('phase-changed', {
        gameState: room.gameState,
        room: room,
        phase: 'drawing'
      });

      // Start drawing timer
      startGameTimer(room, roomCode, room.gameState.drawTime, 'drawing', () => {
        // Auto-submit any missing drawings
        autoSubmitMissingDrawings(room, roomCode);
        
        // Small delay to allow auto-submissions to process
        setTimeout(() => {
          // Move to reveal phase
          room.gameState.phase = 'reveal';
          
          console.log(`🎭 Moving to reveal phase - Round ${room.gameState.currentRound}`);
          
          io.to(roomCode).emit('phase-changed', {
            gameState: room.gameState,
            room: room,
            phase: 'reveal',
            allDrawings: room.gameState.drawings,
            originalMonster: room.gameState.currentMonster
          });
        }, 2000);
      });
    });
  }

  // Submit drawing
  socket.on('submit-drawing', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    const player = room.players.find(p => p.id === socket.id);
    
    // Update room activity
    room.lastActivity = Date.now();
    
    if (!player || room.gameState.phase !== 'drawing') {
      console.log(`❌ Drawing submission rejected: player=${player?.name}, phase=${room.gameState.phase}`);
      return;
    }
    
    // Don't allow current drawer to submit
    if (socket.id === room.gameState.currentDrawer) {
      console.log(`❌ Drawing submission rejected: ${player.name} is the current drawer`);
      socket.emit('drawing-error', { error: 'Current drawer cannot submit drawing' });
      return;
    }

    // Check if already submitted
    if (room.gameState.drawings.find(d => d.playerId === socket.id)) {
      socket.emit('drawing-error', { error: 'Already submitted drawing' });
      return;
    }

    // Store the drawing
    const drawing = {
      playerId: socket.id,
      playerName: player.name,
      imageData: data.imageData,
      submittedAt: Date.now()
    };

    room.gameState.drawings.push(drawing);

    console.log(`🎨 Drawing submitted by ${player.name} in room ${roomCode} (${room.gameState.drawings.length} total)`);

    // Notify room that a drawing was submitted
    const expectedSubmissions = room.players.filter(p => p.id !== room.gameState.currentDrawer).length;
    
    io.to(roomCode).emit('drawing-submitted', {
      playerName: player.name,
      totalSubmitted: room.gameState.drawings.length,
      totalExpected: expectedSubmissions
    });

    // Check if all players have submitted (early end)
    if (checkAllPlayersSubmitted(room) && room.gameState.timerInterval) {
      console.log(`⚡ All players submitted drawings early in room ${roomCode}`);
      clearInterval(room.gameState.timerInterval);
      room.gameState.timerInterval = null;
      
      // Move to reveal phase early
      room.gameState.phase = 'reveal';
      
      io.to(roomCode).emit('phase-changed', {
        gameState: room.gameState,
        room: room,
        phase: 'reveal',
        allDrawings: room.gameState.drawings,
        originalMonster: room.gameState.currentMonster,
        earlyEnd: true
      });
    }
  });

  // Auto-submit response (when time runs out)
  socket.on('auto-submit-response', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    const player = room.players.find(p => p.id === socket.id);
    
    // Update room activity
    room.lastActivity = Date.now();
    
    if (!player || room.gameState.phase !== 'drawing') return;
    
    // Don't allow current drawer to submit
    if (socket.id === room.gameState.currentDrawer) return;

    // Check if already submitted
    if (room.gameState.drawings.find(d => d.playerId === socket.id)) return;

    // Store the auto-submitted drawing (might be blank)
    const drawing = {
      playerId: socket.id,
      playerName: player.name,
      imageData: data.imageData || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent pixel
      submittedAt: Date.now(),
      autoSubmitted: true
    };

    room.gameState.drawings.push(drawing);

    console.log(`⏰ Auto-submitted drawing for ${player.name} in room ${roomCode}`);
  });

  // Advance to next round (host only)
  socket.on('next-round', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Only host can advance
    if (room.hostId !== socket.id) {
      console.log(`❌ Next round rejected: ${socket.id.substring(0, 8)} is not host (host is ${room.hostId.substring(0, 8)})`);
      return;
    }

    console.log(`➡️ Advancing to next round in room ${roomCode}`);
    console.log(`➡️ Current: Round ${room.gameState.currentRound}, Drawer Index ${room.gameState.currentDrawerIndex}`);

    // FIXED: Advance to next round and next drawer
    room.gameState.currentRound++;
    room.gameState.currentDrawerIndex = (room.gameState.currentDrawerIndex + 1) % room.players.length;

    console.log(`➡️ New: Round ${room.gameState.currentRound}, Drawer Index ${room.gameState.currentDrawerIndex}`);

    // Start next round immediately
    console.log(`🎮 Starting next round ${room.gameState.currentRound} in room ${roomCode}`);
    startNextRound(room, roomCode);
  });

  // Finish game (host only)
  socket.on('finish-game', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Update room activity
    room.lastActivity = Date.now();
    
    // Only host can finish game
    if (room.hostId !== socket.id) {
      console.log(`❌ Finish game rejected: ${socket.id.substring(0, 8)} is not host (host is ${room.hostId.substring(0, 8)})`);
      return;
    }

    console.log(`🏁 Host finishing game in room ${roomCode}`);
    
    // Clear any active timers
    if (room.gameState.timerInterval) {
      clearInterval(room.gameState.timerInterval);
      room.gameState.timerInterval = null;
    }
    
    // End the game
    room.gameState.phase = 'finished';
    io.to(roomCode).emit('game-finished', {
      room: room,
      gameState: room.gameState
    });
  });

  // Get room state
  socket.on('get-room-state', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) {
      socket.emit('room-state', { error: 'Not in a room' });
      return;
    }

    // Update room activity
    playerRoom.room.lastActivity = Date.now();

    socket.emit('room-state', {
      room: playerRoom.room,
      roomCode: playerRoom.roomCode
    });
  });

  // Handle disconnection with enhanced cleanup
  socket.on('disconnect', (reason) => {
    const playerData = players.get(socket.id);
    const playerName = playerData?.name || 'Unknown';
    
    console.log(`🔌 Client disconnected: ${playerName} (${socket.id.substring(0, 8)}) - Reason: ${reason}`);
    
    // Only clean up if player was in a room (not just browsing)
    if (playerData?.roomCode) {
      const result = removePlayerFromRoom(socket.id, playerName, false);
      if (result) {
        const { roomCode, room, deleted } = result;
        
        if (deleted) {
          console.log(`🗑️ Room ${roomCode} deleted - no players left`);
        } else if (room) {
          // Notify remaining players
          socket.to(roomCode).emit('player-left', {
            room: room,
            leftPlayerId: socket.id,
            leftPlayerName: playerName
          });
          
          console.log(`📢 Notified remaining players in ${roomCode} about ${playerName} disconnecting`);
        }
      }
    }

    // Always remove from players map
    players.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    players: players.size,
    uptime: process.uptime()
  });
});

// API endpoint to get room info (for debugging)
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.entries()).map(([code, room]) => ({
    code,
    playerCount: room.players.length,
    phase: room.gameState.phase,
    currentRound: room.gameState.currentRound,
    currentDrawer: room.players.find(p => p.id === room.gameState.currentDrawer)?.name || 'Unknown',
    currentDrawerIndex: room.gameState.currentDrawerIndex,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity,
    minutesInactive: Math.round((Date.now() - room.lastActivity) / 60000)
  }));
  
  res.json({ 
    rooms: roomList,
    totalRooms: rooms.size,
    totalPlayers: players.size
  });
});

// Debug endpoint to get specific room details
app.get('/api/rooms/:roomCode', (req, res) => {
  const room = getRoom(req.params.roomCode.toUpperCase());
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  
  res.json({
    room: {
      ...room,
      players: room.players.map(p => ({ 
        ...p, 
        id: p.id.substring(0, 8) + '...' // Truncate IDs for privacy
      }))
    }
  });
});

// Debug endpoint to get player info
app.get('/api/players', (req, res) => {
  const playerList = Array.from(players.entries()).map(([socketId, playerData]) => ({
    socketId: socketId.substring(0, 8) + '...',
    name: playerData.name,
    roomCode: playerData.roomCode,
    joinedAt: playerData.joinedAt,
    minutesConnected: Math.round((Date.now() - playerData.joinedAt) / 60000)
  }));
  
  res.json({ 
    players: playerList,
    totalPlayers: players.size
  });
});

// Force cleanup endpoint (for debugging)
app.post('/api/cleanup', (req, res) => {
  const { roomCode } = req.body;
  
  if (roomCode) {
    const room = getRoom(roomCode.toUpperCase());
    if (room) {
      cleanupRoom(room, roomCode.toUpperCase());
      rooms.delete(roomCode.toUpperCase());
      res.json({ success: true, message: `Room ${roomCode.toUpperCase()} cleaned up` });
    } else {
      res.status(404).json({ error: 'Room not found' });
    }
  } else {
    // Clean up all inactive rooms
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes for manual cleanup
    let cleanedCount = 0;
    
    for (const [roomCode, room] of rooms.entries()) {
      if (now - room.lastActivity > inactiveThreshold) {
        cleanupRoom(room, roomCode);
        rooms.delete(roomCode);
        cleanedCount++;
      }
    }
    
    res.json({ 
      success: true, 
      message: `Cleaned up ${cleanedCount} inactive rooms`,
      remainingRooms: rooms.size
    });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🎮 Drawblins Party Mode server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔍 Debug API available at /api/rooms`);
  console.log(`📱 Enhanced iOS support enabled`);
  console.log(`🧹 Automatic room cleanup every 10 minutes`);
});