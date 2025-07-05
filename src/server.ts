import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import lyricsRouter from './api/lyrics';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for now, you might want to restrict this in production
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', lyricsRouter);

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('player-state-change', (state) => {
    socket.broadcast.emit('player-state-update', state);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
