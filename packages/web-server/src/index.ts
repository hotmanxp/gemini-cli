import express from 'express';
import cors from 'cors';
import sessionEventsRouter from './routes/session-events.js';
import sessionsRouter from './routes/sessions.js';

const app = express();
const PORT = process.env['WEB_SERVER_PORT'] || 4097;

app.use(
  cors({
    origin: '*',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(sessionEventsRouter);
app.use('/sessions', sessionsRouter);

app.listen(PORT, () => {
  console.log(`Web server running on http://localhost:${PORT}`);
});
