import express from 'express';
import cors from 'cors';
import lyricsRouter from './api/lyrics';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', lyricsRouter);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 