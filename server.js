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
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files in production (optional - you can keep GitHub Pages)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Game state storage (in production, consider Redis)
const rooms = new Map();
const players = new Map(); // socketId -> playerInfo

// Utility functions
function generateRoomCode() {
  const words = ['DRAW', 'GOBZ', 'ARTS', 'PLAY', 'GAME', 'DOOD', 'PICS', 'MARK', 'SKETCH', 'CRAFT'];
  return words[Math.floor(Math.random() * words.length)];
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
      currentRound: 1,
      maxRounds: 5,
      viewTime: 20,
      drawTime: 120, // 2 minutes in seconds
      currentMonster: null,
      drawings: [],
      timer: 0
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
      rooms.delete(roomCode);
      return { roomCode, deleted: true };
    }
  }

  return { roomCode, room };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

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

  // Start game
  socket.on('start-game', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Only host can start game
    if (room.hostId !== socket.id) return;

    // Need at least 2 players
    if (room.players.length < 2) {
      socket.emit('game-error', { error: 'Need at least 2 players to start' });
      return;
    }

    // Update game state
    room.gameState.phase = 'studying';
    room.gameState.currentDrawer = room.players[0].id;
    room.gameState.viewTime = data.viewTime || 20;
    room.gameState.drawTime = data.drawTime || 120;
    
    // In a real implementation, you'd select a random monster here
    room.gameState.currentMonster = `monster${Math.floor(Math.random() * 266) + 1}.png`;

    io.to(roomCode).emit('game-started', {
      gameState: room.gameState,
      room: room
    });

    console.log(`Game started in room ${roomCode}`);
  });

  // Submit drawing
  socket.on('submit-drawing', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || room.gameState.phase !== 'drawing') return;

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
      totalPlayers: room.players.length - 1 // exclude current drawer
    });

    console.log(`Drawing submitted by ${player.name} in room ${roomCode}`);
  });

  // Timer management - start phase timer
  socket.on('start-phase-timer', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Only host can start timers
    if (room.hostId !== socket.id) return;

    const { phase, duration } = data;
    
    // Start countdown
    room.gameState.timer = duration;
    
    const interval = setInterval(() => {
      room.gameState.timer--;
      
      // Send timer update every 5 seconds or last 10 seconds
      if (room.gameState.timer % 5 === 0 || room.gameState.timer <= 10) {
        io.to(roomCode).emit('timer-update', {
          timeLeft: room.gameState.timer,
          phase: room.gameState.phase
        });
      }
      
      // Phase complete
      if (room.gameState.timer <= 0) {
        clearInterval(interval);
        
        // Auto-advance phase
        if (phase === 'studying') {
          room.gameState.phase = 'drawing';
          room.gameState.drawings = []; // Reset drawings
          room.gameState.timer = room.gameState.drawTime;
        } else if (phase === 'drawing') {
          room.gameState.phase = 'reveal';
          room.gameState.timer = 0;
        }
        
        io.to(roomCode).emit('phase-changed', {
          gameState: room.gameState,
          room: room
        });
        
        console.log(`Auto-advanced to ${room.gameState.phase} in room ${roomCode}`);
      }
    }, 1000);

    console.log(`Started ${phase} timer (${duration}s) in room ${roomCode}`);
  });

  // Manual phase transitions (for host control)
  socket.on('advance-phase', (data) => {
    const playerRoom = getPlayerRoom(socket.id);
    if (!playerRoom) return;

    const { room, roomCode } = playerRoom;
    
    // Only host can manually advance phases
    if (room.hostId !== socket.id) return;

    if (room.gameState.phase === 'reveal') {
      // Move to next round or end game
      room.gameState.currentRound++;
      
      if (room.gameState.currentRound > room.gameState.maxRounds) {
        room.gameState.phase = 'finished';
      } else {
        // Next player becomes drawer
        const currentDrawerIndex = room.players.findIndex(p => p.id === room.gameState.currentDrawer);
        const nextDrawerIndex = (currentDrawerIndex + 1) % room.players.length;
        room.gameState.currentDrawer = room.players[nextDrawerIndex].id;
        room.gameState.phase = 'studying';
        
        // Select new monster
        room.gameState.currentMonster = `monster${Math.floor(Math.random() * 266) + 1}.png`;
      }
      
      io.to(roomCode).emit('phase-changed', {
        gameState: room.gameState,
        room: room
      });
    }

    console.log(`Host advanced phase to ${room.gameState.phase} in room ${roomCode}`);
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
    console.log(`Player disconnected: ${socket.id}`);
    
    const result = removePlayerFromRoom(socket.id);
    if (result) {
      const { roomCode, room, deleted } = result;
      
      if (deleted) {
        console.log(`Room ${roomCode} deleted - no players left`);
      } else {
        // Notify remaining players
        io.to(roomCode).emit('player-left', {
          room: room,
          leftPlayerId: socket.id
        });
        console.log(`Player left room ${roomCode}`);
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
    createdAt: room.createdAt
  }));
  
  res.json({ rooms: roomList });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Drawblins server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});