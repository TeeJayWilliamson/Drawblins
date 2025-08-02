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
  const words = ['DRAW', 'GOBZ', 'ARTS', 'PLAY', 'GAME', 'DOOD', 'PICS', 'MARK', 'SKETCH', 'CRAFT'];
  return words[Math.floor(Math.random() * words.length)];
}

function getRandomMonsterByDifficulty(difficulty = 'standard') {
  const range = difficultyRanges[difficulty] || difficultyRanges.standard;
  const monsterNum = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  return `monster${monsterNum}.png`;
}

function createRoom(hostId, hostName, isMainScreen = false) {
  let roomCode;
  do {
    roomCode = generateRoomCode();
  } while (rooms.has(roomCode));

  const room = {
    code: roomCode,
    hostId: hostId,
    mainScreenId: isMainScreen ? hostId : null,
    players: [{
      id: hostId,
      name: hostName,
      isHost: true,
      isMainScreen: isMainScreen,
      isReady: false
    }],
    gameState: {
      phase: 'lobby', // lobby, studying, drawing, reveal, finished
      currentDrawer: null,
      currentDrawerIndex: 0,
      currentRound: 1,
      maxRounds: 5,
      viewTime: 20,
      drawTime: 120, // 2 minutes in seconds
      currentMonster: null,
      drawings: [], // {playerId, playerName, imageData, submittedAt}
      timer: 0,
      usedMonsters: [],
      difficulty: 'standard'
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
  const wasMainScreen = room.mainScreenId === playerId;
  
  room.players = room.players.filter(p => p.id !== playerId);

  // If main screen left, clear it
  if (wasMainScreen) {
    room.mainScreenId = null;
  }

  // If host left, make someone else host or delete room
  if (room.hostId === playerId) {
    if (room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    } else {
      rooms.delete(roomCode);
      return { roomCode, deleted: true };
    }
  }

  return { roomCode, room, wasMainScreen };
}

function selectNextDrawer(room) {
  const nonMainScreenPlayers = room.players.filter(p => !p.isMainScreen);
  if (nonMainScreenPlayers.length === 0) return null;
  
  room.gameState.currentDrawerIndex = (room.gameState.currentDrawerIndex) % nonMainScreenPlayers.length;
  return nonMainScreenPlayers[room.gameState.currentDrawerIndex].id;
}

function startGameTimer(room, roomCode, duration, phase, onComplete) {
  room.gameState.timer = duration;
  
  const timerInterval = setInterval(() => {
    room.gameState.timer--;
    
    // Send timer updates
    if (room.gameState.timer % 5 === 0 || room.gameState.timer <= 10) {
      io.to(roomCode).emit('timer-update', {
        timeLeft: room.gameState.timer,
        phase: phase
      });
    }
    
    // Phase complete
    if (room.gameState.timer <= 0) {
      clearInterval(timerInterval);
      onComplete();
    }
  }, 1000);
  
  return timerInterval;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Create a new room (can be main screen or player)
  socket.on('create-room', (data) => {
    const { playerName, isMainScreen = false } = data;
    
    try {
      const room = createRoom(socket.id, playerName, isMainScreen);
      
      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomCode: room.code,
        isMainScreen: isMainScreen
      });

      socket.join(room.code);
      
      socket.emit('room-created', {
        success: true,
        roomCode: room.code,
        room: room,
        isMainScreen: isMainScreen
      });

      console.log(`Room ${room.code} created by ${playerName} (main screen: ${isMainScreen})`);
    } catch (error) {
      socket.emit('room-created', {
        success: false,
        error: 'Failed to create room'
      });
    }
  });

  // Join existing room
  socket.on('join-room', (data) => {
    const { roomCode, playerName, isMainScreen = false } = data;
    
    try {
      const room = getRoom(roomCode);
      
      if (!room) {
        socket.emit('room-joined', {
          success: false,
          error: 'Room not found'
        });
        return;
      }

      // Check if trying to join as main screen when one already exists
      if (isMainScreen && room.mainScreenId) {
        socket.emit('room-joined', {
          success: false,
          error: 'Main screen already connected'
        });
        return;
      }

      // Check if player name already exists (only for non-main screen)
      if (!isMainScreen && room.players.find(p => p.name === playerName && !p.isMainScreen)) {
        socket.emit('room-joined', {
          success: false,
          error: 'Player name already taken'
        });
        return;
      }

      // Check room capacity (max 8 players + 1 main screen)
      const nonMainScreenPlayers = room.players.filter(p => !p.isMainScreen);
      if (!isMainScreen && nonMainScreenPlayers.length >= 8) {
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
        isMainScreen: isMainScreen,
        isReady: false
      };

      room.players.push(newPlayer);
      
      // Set as main screen if applicable
      if (isMainScreen) {
        room.mainScreenId = socket.id;
      }
      
      players.set(socket.id, {
        id: socket.id,
        name: playerName,
        roomCode: roomCode,
        isMainScreen: isMainScreen
      });

      socket.join(roomCode);

      // Notify everyone in the room
      socket.emit('room-joined', {
        success: true,
        room: room,
        isMainScreen: isMainScreen
      });

      socket.to(roomCode).emit('player-joined', {
        player: newPlayer,
        room: room
      });

      console.log(`${playerName} joined room ${roomCode} (main screen: ${isMainScreen})`);
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

    // Need main screen
    if (!room.mainScreenId) {
      socket.emit('game-error', { error: 'Main screen must be connected to start game' });
      return;
    }

    // Need at least 2 players (excluding main screen)
    const nonMainScreenPlayers = room.players.filter(p => !p.isMainScreen);
    if (nonMainScreenPlayers.length < 2) {
      socket.emit('game-error', { error: 'Need at least 2 players to start' });
      return;
    }

    // Update game settings
    room.gameState.viewTime = data.viewTime || 20;
    room.gameState.drawTime = data.drawTime || 120;
    room.gameState.difficulty = data.difficulty || 'standard';
    room.gameState.maxRounds = data.maxRounds || nonMainScreenPlayers.length;

    // Start first round
    startNextRound(room, roomCode);

    console.log(`Game started in room ${roomCode}`);
  });

  function startNextRound(room, roomCode) {
    // Select next drawer
    room.gameState.currentDrawer = selectNextDrawer(room);
    
    if (!room.gameState.currentDrawer) {
      io.to(roomCode).emit('game-error', { error: 'No valid drawer found' });
      return;
    }

    // Select monster (avoid repeats)
    let monster;
    do {
      monster = getRandomMonsterByDifficulty(room.gameState.difficulty);
    } while (room.gameState.usedMonsters.includes(monster) && room.gameState.usedMonsters.length < totalMonsters);
    
    room.gameState.currentMonster = monster;
    room.gameState.usedMonsters.push(monster);
    room.gameState.drawings = [];
    room.gameState.phase = 'studying';

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

    // Start studying timer
    startGameTimer(room, roomCode, room.gameState.viewTime, 'studying', () => {
      // Move to drawing phase
      room.gameState.phase = 'drawing';
      
      io.to(roomCode).emit('phase-changed', {
        gameState: room.gameState,
        room: room,
        phase: 'drawing'
      });

      // Start drawing timer
      startGameTimer(room, roomCode, room.gameState.drawTime, 'drawing', () => {
        // Move to reveal phase
        room.gameState.phase = 'reveal';
        
        io.to(roomCode).emit('phase-changed', {
          gameState: room.gameState,
          room: room,
          phase: 'reveal',
          allDrawings: room.gameState.drawings,
          originalMonster: room.gameState.currentMonster
        });
      });
    });
  }

  // Submit drawing
  socket.on('submit-drawing', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || room.gameState.phase !== 'drawing' || player.isMainScreen) return;
    
    // Don't allow current drawer to submit
    if (socket.id === room.gameState.currentDrawer) return;

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

    // Notify room that a drawing was submitted
    io.to(roomCode).emit('drawing-submitted', {
      playerName: player.name,
      totalSubmitted: room.gameState.drawings.length,
      totalExpected: room.players.filter(p => !p.isMainScreen && p.id !== room.gameState.currentDrawer).length
    });

    console.log(`Drawing submitted by ${player.name} in room ${roomCode}`);
  });

  // Advance to next round (host only)
  socket.on('next-round', () => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Only host can advance
    if (room.hostId !== socket.id) return;

    room.gameState.currentRound++;
    room.gameState.currentDrawerIndex++;

    if (room.gameState.currentRound > room.gameState.maxRounds) {
      // Game finished
      room.gameState.phase = 'finished';
      io.to(roomCode).emit('game-finished', {
        room: room,
        gameState: room.gameState
      });
    } else {
      // Start next round
      startNextRound(room, roomCode);
    }

    console.log(`Advanced to round ${room.gameState.currentRound} in room ${roomCode}`);
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
      const { roomCode, room, deleted, wasMainScreen } = result;
      
      if (deleted) {
        console.log(`Room ${roomCode} deleted - no players left`);
      } else {
        // Notify remaining players
        socket.to(roomCode).emit('player-left', {
          room: room,
          leftPlayerId: socket.id,
          wasMainScreen: wasMainScreen
        });
        
        // If main screen disconnected during game, pause/end game
        if (wasMainScreen && room.gameState.phase !== 'lobby') {
          io.to(roomCode).emit('main-screen-disconnected');
        }
        
        console.log(`Player left room ${roomCode} (was main screen: ${wasMainScreen})`);
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
    hasMainScreen: !!room.mainScreenId,
    currentRound: room.gameState.currentRound,
    createdAt: room.createdAt
  }));
  
  res.json({ rooms: roomList });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Drawblins Party Mode server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});