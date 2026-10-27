require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const routes = require('./routes');
const Seat = require('./models/Seat');
const { notFound, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');
const { setIO, emitSeats } = require('./utils/realtime');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1); // behind nginx in Docker: use the real visitor IP for rate limiting
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, { cors: { origin: clientUrl, credentials: true } });
setIO(io);
io.on('connection', (socket) => {
  socket.on('show:join', (showId) => socket.join(`show:${showId}`));
  socket.on('show:leave', (showId) => socket.leave(`show:${showId}`));
});

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api', apiLimiter, routes);
app.use(notFound);
app.use(errorHandler);

// Release seat holds that ran out of time, and tell everyone watching that show
async function releaseExpiredHolds() {
  const now = new Date();
  const expired = await Seat.find({ status: 'locked', lockedUntil: { $lt: now } }).select('_id show').lean();
  if (!expired.length) return;
  await Seat.updateMany(
    { _id: { $in: expired.map((s) => s._id) } },
    { status: 'available', lockedBy: null, lockedUntil: null }
  );
  const byShow = expired.reduce((acc, s) => {
    (acc[s.show] = acc[s.show] || []).push(s._id);
    return acc;
  }, {});
  Object.entries(byShow).forEach(([showId, ids]) => emitSeats(showId, ids, 'available'));
}

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => {
    setInterval(() => releaseExpiredHolds().catch((e) => console.error('Hold cleanup failed:', e.message)), 15 * 1000);
    server.listen(PORT, () => console.log(`IMovies API running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });
