const router = require('express').Router();
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const auth = require('../controllers/authController');
const movies = require('../controllers/movieController');
const theatres = require('../controllers/theatreController');
const shows = require('../controllers/showController');
const bookings = require('../controllers/bookingController');
const admin = require('../controllers/adminController');

router.get('/health', (req, res) => res.json({ ok: true }));

// Auth
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', protect, auth.me);
router.put('/auth/me', protect, auth.updateProfile);

// Movies (public read, admin write)
router.get('/movies', movies.list);
router.get('/movies/filters', movies.filters);
router.get('/movies/:id', movies.get);
router.post('/movies', protect, adminOnly, movies.create);
router.put('/movies/:id', protect, adminOnly, movies.update);
router.delete('/movies/:id', protect, adminOnly, movies.remove);

// Theatres
router.get('/theatres', theatres.list);
router.post('/theatres', protect, adminOnly, theatres.create);
router.put('/theatres/:id', protect, adminOnly, theatres.update);
router.delete('/theatres/:id', protect, adminOnly, theatres.remove);

// Shows and seats
router.get('/shows', shows.list);
router.get('/shows/:id', optionalAuth, shows.get);
router.post('/shows', protect, adminOnly, shows.create);
router.put('/shows/:id', protect, adminOnly, shows.update);
router.delete('/shows/:id', protect, adminOnly, shows.remove);
router.post('/shows/:id/lock', protect, shows.lockSeats);
router.post('/shows/:id/unlock', protect, shows.unlockSeats);

// Bookings
router.post('/bookings', protect, bookings.create);
router.get('/bookings/mine', protect, bookings.mine);
router.get('/bookings/:id', protect, bookings.get);
router.put('/bookings/:id/cancel', protect, bookings.cancel);

// Notifications
router.get('/notifications', protect, admin.notifications);
router.put('/notifications/read', protect, admin.markNotificationsRead);

// Admin
router.get('/admin/stats', protect, adminOnly, admin.stats);
router.get('/admin/bookings', protect, adminOnly, admin.bookings);
router.get('/admin/users', protect, adminOnly, admin.users);
router.put('/admin/users/:id/role', protect, adminOnly, admin.setUserRole);

module.exports = router;
