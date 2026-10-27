// Holds the Socket.io instance so controllers can broadcast seat changes.
let io = null;

exports.setIO = (instance) => {
  io = instance;
};

exports.emitSeats = (showId, seats, status) => {
  if (!io || !seats.length) return;
  io.to(`show:${showId}`).emit('seats:update', {
    showId: String(showId),
    seats: seats.map(String),
    status,
  });
};
