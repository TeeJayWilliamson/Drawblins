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
  }
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
    createdAt: Date.now()
  };

  rooms.set(roomCode, room);
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

function removePlayerFromRoom(playerId) {
  const playerRoom = getPlayerRoom(playerId);
  if (!playerRoom) return null;

  const { roomCode, room } = playerRoom;
  
  room.players = room.players.filter(p => p.id !== playerId);

  // If host left, make someone else host or delete room
  if (room.hostId === playerId) {
    if (room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    } else {
      // Clean up timer if room is being deleted
      if (room.gameState.timerInterval) {
        clearInterval(room.gameState.timerInterval);
      }
      rooms.delete(roomCode);
      return { roomCode, deleted: true };
    }
  }

  return { roomCode, room };
}

// FIXED: Proper drawer selection logic
function selectNextDrawer(room) {
  if (room.players.length === 0) return null;
  
  // Get the current drawer index, ensuring it's within bounds
  let currentIndex = room.gameState.currentDrawerIndex || 0;
  
  // Select the player at the current index
  const selectedPlayer = room.players[currentIndex];
  
  console.log(`Selecting drawer: index ${currentIndex}, player:`, selectedPlayer?.name, `(ID: ${selectedPlayer?.id})`);
  
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

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', (data) => {
    const { playerName } = data;
    
    try {
      const room = createRoom(socket.id, playerName);
      
      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomCode: room.code
      });

      socket.join(room.code);
      
      socket.emit('room-created', {
        success: true,
        roomCode: room.code,
        room: room
      });

      console.log(`Room ${room.code} created by ${playerName}`);
    } catch (error) {
      socket.emit('room-created', {
        success: false,
        error: 'Failed to create room'
      });
    }
  });

  // Join existing room
  socket.on('join-room', (data) => {
    const { roomCode, playerName } = data;
    
    try {
      const room = getRoom(roomCode);
      
      if (!room) {
        socket.emit('room-joined', {
          success: false,
          error: 'Room not found'
        });
        return;
      }

      // Check if player name already exists
      if (room.players.find(p => p.name === playerName)) {
        socket.emit('room-joined', {
          success: false,
          error: 'Player name already taken'
        });
        return;
      }

      // Check room capacity (max 8 players)
      if (room.players.length >= 8) {
        socket.emit('room-joined', {
          success: false,
          error: 'Room is full'
        });
        return;
      }

      // Add player to room
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
        roomCode: roomCode
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

      console.log(`${playerName} joined room ${roomCode}`);
    } catch (error) {
      socket.emit('room-joined', {
        success: false,
        error: 'Failed to join room'
      });
    }
  });

  // Start game (only host can do this)
  socket.on('start-game', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
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

    console.log(`Game started in room ${roomCode} with ${room.players.length} players`);
  });

  function startNextRound(room, roomCode) {
    console.log(`Starting round ${room.gameState.currentRound} in room ${roomCode}`);
    console.log(`Current drawer index: ${room.gameState.currentDrawerIndex}`);
    console.log(`Players in room:`, room.players.map(p => `${p.name} (${p.id})`));
    
    // Select next drawer
    room.gameState.currentDrawer = selectNextDrawer(room);
    
    if (!room.gameState.currentDrawer) {
      console.error('No valid drawer found!');
      io.to(roomCode).emit('game-error', { error: 'No valid drawer found' });
      return;
    }

    const currentDrawerPlayer = room.players.find(p => p.id === room.gameState.currentDrawer);
    console.log(`Selected drawer: ${currentDrawerPlayer?.name} (${room.gameState.currentDrawer})`);

    // Select monster (avoid repeats)
    let monster;
    do {
      monster = getRandomMonsterByDifficulty(room.gameState.difficulty);
    } while (room.gameState.usedMonsters.includes(monster) && room.gameState.usedMonsters.length < totalMonsters);
    
    room.gameState.currentMonster = monster;
    room.gameState.usedMonsters.push(monster);
    room.gameState.drawings = [];
    room.gameState.phase = 'studying';

    console.log(`Round ${room.gameState.currentRound}: ${currentDrawerPlayer?.name} will draw ${monster}`);

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

    console.log(`Monster ${monster} sent to drawer ${currentDrawerPlayer?.name}`);

    // Start studying timer
    startGameTimer(room, roomCode, room.gameState.viewTime, 'studying', () => {
      // Move to drawing phase
      room.gameState.phase = 'drawing';
      
      console.log(`Moving to drawing phase - Round ${room.gameState.currentRound}`);
      
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
          
          console.log(`Moving to reveal phase - Round ${room.gameState.currentRound}`);
          
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
    
    if (!player || room.gameState.phase !== 'drawing') {
      console.log(`Drawing submission rejected: player=${player?.name}, phase=${room.gameState.phase}`);
      return;
    }
    
    // Don't allow current drawer to submit
    if (socket.id === room.gameState.currentDrawer) {
      console.log(`Drawing submission rejected: ${player.name} is the current drawer`);
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

    console.log(`Drawing submitted by ${player.name} in room ${roomCode} (${room.gameState.drawings.length} total)`);

    // Notify room that a drawing was submitted
    const expectedSubmissions = room.players.filter(p => p.id !== room.gameState.currentDrawer).length;
    
    io.to(roomCode).emit('drawing-submitted', {
      playerName: player.name,
      totalSubmitted: room.gameState.drawings.length,
      totalExpected: expectedSubmissions
    });

    // Check if all players have submitted (early end)
    if (checkAllPlayersSubmitted(room) && room.gameState.timerInterval) {
      console.log(`All players submitted drawings early in room ${roomCode}`);
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

    console.log(`Auto-submitted drawing for ${player.name} in room ${roomCode}`);
  });

// Advance to next round (host only)
socket.on('next-round', () => {
  const playerRoom = getPlayerRoom(socket.id);
  if (!playerRoom) return;

  const { room, roomCode } = playerRoom;
  
  // Only host can advance
  if (room.hostId !== socket.id) {
    console.log(`Next round rejected: ${socket.id} is not host (host is ${room.hostId})`);
    return;
  }

  console.log(`Advancing to next round in room ${roomCode}`);
  console.log(`Current: Round ${room.gameState.currentRound}, Drawer Index ${room.gameState.currentDrawerIndex}`);

  // FIXED: Advance to next round and next drawer
  room.gameState.currentRound++;
  room.gameState.currentDrawerIndex = (room.gameState.currentDrawerIndex + 1) % room.players.length;

  console.log(`New: Round ${room.gameState.currentRound}, Drawer Index ${room.gameState.currentDrawerIndex}`);

  // REMOVED THE maxRounds CHECK - Game continues indefinitely
  // Start next round immediately
  console.log(`Starting next round ${room.gameState.currentRound} in room ${roomCode}`);
  startNextRound(room, roomCode);
});

// NEW: Finish game (host only)
socket.on('finish-game', () => {
  const playerRoom = getPlayerRoom(socket.id);
  if (!playerRoom) return;

  const { room, roomCode } = playerRoom;
  
  // Only host can finish game
  if (room.hostId !== socket.id) {
    console.log(`Finish game rejected: ${socket.id} is not host (host is ${room.hostId})`);
    return;
  }

  console.log(`Host finishing game in room ${roomCode}`);
  
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

    socket.emit('room-state', {
      room: playerRoom.room,
      roomCode: playerRoom.roomCode
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    const result = removePlayerFromRoom(socket.id);
    if (result) {
      const { roomCode, room, deleted } = result;
      
      if (deleted) {
        console.log(`Room ${roomCode} deleted - no players left`);
      } else {
        // Notify remaining players
        socket.to(roomCode).emit('player-left', {
          room: room,
          leftPlayerId: socket.id
        });
        
        console.log(`Player left room ${roomCode} - ${room.players.length} players remaining`);
      }
    }

    players.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    players: players.size 
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
    createdAt: room.createdAt
  }));
  
  res.json({ rooms: roomList });
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
      players: room.players.map(p => ({ ...p, id: p.id.substring(0, 8) + '...' })) // Truncate IDs for privacy
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Drawblins Party Mode server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Debug API available at /api/rooms`);
});