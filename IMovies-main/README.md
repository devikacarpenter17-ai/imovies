<<<<<<< HEAD
# IMovies

A MERN cinema booking site: browse movies, pick a showtime, choose exact seats on a live seat map, pay (simulated) and keep your tickets.

- **Frontend:** React 18, Vite, Bootstrap 5 plus custom CSS, Redux Toolkit, React Router, Socket.io client
- **Backend:** Express, MongoDB (Mongoose), JWT, bcryptjs, Socket.io, Helmet, express-rate-limit
- **Look:** dark cinematic theme, generated poster art (no image files needed), curved-screen seat map, paper ticket

## Run it

**Windows, one click:** install Node.js (LTS) and MongoDB Community Server once, then double-click `start-imovies.bat`. On the first run it creates `server/.env` with a secret key, installs packages, adds demo data and opens the site at http://localhost:5173. To stop it, close the two command windows it opens.

**Manual steps (any system):**

You need Node 18+ and MongoDB running locally (or a MongoDB Atlas connection string).

```bash
# 1. API
cd server
cp .env.example .env        # then set JWT_SECRET to a long random string
npm install
npm run seed                # demo movies, theatres, a week of shows, 2 accounts
npm run dev                 # http://localhost:5000

# 2. Website (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173. The dev server proxies `/api` and the socket connection to port 5000, so there is nothing else to configure.

### Using MongoDB Atlas (cloud) instead of a local database

1. In Atlas, create a free cluster (M0).
2. **Database Access**: add a database user and note the password. Use letters and numbers only, or URL-encode special characters.
3. **Network Access**: add your IP address (or `0.0.0.0/0` while testing).
4. **Connect > Drivers**: copy the connection string and put the database name `imovies` before the `?`.
5. Open `server/.env` (the .bat creates it on first run) and set:
   `MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/imovies?retryWrites=true&w=majority`

`start-imovies.bat` detects an Atlas string and skips the local MongoDB step. Never share or commit this string, it contains your password.

### Run with Docker (no Node or MongoDB install needed)

Install Docker Desktop and start it, then double-click `start-docker.bat` (Windows) or run `docker compose up -d --build` after copying `.env.example` to `.env` and setting `JWT_SECRET`. It starts MongoDB, the API and the website, loads the demo data and opens http://localhost:8080.

- Stop: `stop-docker.bat` (data is kept). Delete all data too: `docker compose down -v`
- Logs: `docker compose logs -f server`
- MongoDB Atlas: put `MONGO_URI=...` in the root `.env` file. The bundled database still starts but is not used
- The first build takes a few minutes. After code changes, run `start-docker.bat` again to rebuild
- If you open the site from another address than `localhost:8080`, set `CLIENT_URL` in `.env` to that address

### Real movies and posters

Movies, posters, descriptions and trailers are real. The importer tries **TMDB** first when `TMDB_API_KEY` is set (richest data: cast, ratings, banners). If TMDB is unreachable or no key is set, it automatically uses **Apple iTunes**, which needs no key and is rarely blocked. If both fail, fictional placeholder movies are used.

#### Optional: TMDB key

The site shows real, currently playing movies for India with posters, banners, cast, ratings and trailers from [TMDB](https://www.themoviedb.org). This needs a free key:

1. Create a free account at https://www.themoviedb.org
2. Open https://www.themoviedb.org/settings/api, request an API key (choose Developer, personal or educational use) and copy the **API Key**
3. Paste it when `start-imovies.bat` or `start-docker.bat` asks, or add `TMDB_API_KEY=your_key` to `server/.env` (root `.env` for Docker) and run `npm run import:movies`

To refresh the movie list later, double-click `update-movies.bat` (Docker: `docker compose exec server node scripts/importMovies.js`). Without a key, fictional placeholder movies are used. Showtimes, theatres and seat availability are generated, because real cinema schedules are not available from any free public source. Add your own theatres in the admin panel.

### Demo accounts

| Role  | Email             | Password  |
|-------|-------------------|-----------|
| Admin | admin@imovies.com | Admin@123 |
| User  | user@imovies.com  | User@123  |

Change both passwords before putting this anywhere public. `npm run seed:reset` wipes the database and reseeds it.

## What you can do

- **Browse and filter** by title, genre, language, city, date and sort order, with pagination
- **Pick a show** on a 7-day date strip, grouped by theatre, with "filling fast" and "sold out" states
- **Choose seats** on a map with Standard, Premium and Recliner tiers. Seats other people book appear instantly (Socket.io)
- **Seat holds:** pressing Continue holds your seats for 5 minutes (`SEAT_HOLD_MINUTES`). Expired holds are released automatically
- **Pay** by card, UPI or wallet (simulated). Test failures: card ending `0000`, or a UPI ID starting `fail`
- **Tickets and history:** upcoming, past and cancelled tabs. Cancel up to 2 hours before the show; seats are released and the payment is marked refunded
- **Notifications:** bell in the navbar for booking, payment and cancellation updates
- **Admin panel** (`/admin`): revenue overview, movie CRUD, theatre creation, show scheduling (screen clash detection), all bookings

## Project layout

```
server/
  config/db.js
  models/        User Movie Theatre Show Seat Booking Payment Notification
  controllers/   auth movie theatre show booking admin
  middleware/    auth (protect, adminOnly, optionalAuth), error, rateLimit
  routes/index.js
  utils/         helpers, realtime (socket broadcast)
  seed.js  server.js
client/
  src/
    pages/       Home Movies MovieDetail SeatSelection Checkout BookingView MyBookings Auth Admin
    components/  Navbar Poster MovieCard Modal Pager DateStrip Ticket ProtectedRoute Footer
    features/authSlice.js   context/CityContext.jsx   index.css
```

## API summary

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public (rate limited) |
| GET/PUT | `/api/auth/me` | signed in |
| GET | `/api/movies`, `/api/movies/filters`, `/api/movies/:id` | public |
| POST/PUT/DELETE | `/api/movies`, `/api/movies/:id` | admin |
| GET | `/api/theatres` | public. POST/PUT/DELETE: admin |
| GET | `/api/shows`, `/api/shows/:id` | public (seat map included) |
| POST/PUT/DELETE | `/api/shows` | admin |
| POST | `/api/shows/:id/lock`, `/unlock` | signed in |
| POST | `/api/bookings` | signed in |
| GET | `/api/bookings/mine`, `/api/bookings/:id` | signed in (owner or admin) |
| PUT | `/api/bookings/:id/cancel` | signed in (owner or admin) |
| GET/PUT | `/api/notifications`, `/api/notifications/read` | signed in |
| GET | `/api/admin/stats`, `/api/admin/bookings` | admin |

## How double-booking is prevented

Seats are real documents with a status (`available`, `locked`, `booked`). Locking uses a single conditional `updateMany` that only claims seats that are free, expired, or already yours, then verifies it got all of them. If someone else won any seat, the claim is rolled back and the user is told. Booking only converts holds that still belong to the paying user. A 15-second sweep releases expired holds and broadcasts them to everyone watching.

## Security notes

- Passwords hashed with bcrypt. Public sign-up can never create an admin (role is not read from the request)
- JWT in the `Authorization` header, verified on every protected route. Admin routes also check the role
- Helmet headers, CORS limited to `CLIENT_URL`, global rate limit plus a stricter one on sign-in
- Server-side validation on auth, seat limits, show clashes and cancellation windows
- The token is stored in `localStorage` for simplicity. For production, consider an httpOnly cookie
- Payments are simulated. Replace `simulateGateway` in `bookingController.js` with Razorpay or Stripe before taking real money

## Ideas for next steps

Multi-language poster images, food add-ons, email tickets, promo codes, seat-map editor for admins, automated tests (Jest + Supertest for the API).
=======
# IMovies
>>>>>>> 3c701bfa6c3e7961a5c27db03cd1f32d93fe3179
