require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const fs = require('fs');

const productsRouter = require('./routes/products');
const stockRouter = require('./routes/stock');
const uploadRouter = require('./routes/upload');
const dashboardRouter = require('./routes/dashboard');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  store: new pgSession({
    conString: process.env.SUPABASE_DB_URL,
    tableName: 'user_sessions',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET || 'rahasia123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// Middleware cek login — kecuali route auth & assets
function requireLogin(req, res, next) {
  const publicPaths = ['/api/auth/login', '/login.html', '/css/', '/js/login.js'];
  const isPublic = publicPaths.some(p => req.path.startsWith(p));
  if (isPublic) return next();

  if (req.session?.loggedIn) return next();

  // Kalau request API, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Kalau request halaman, redirect ke login
  res.redirect('/login.html');
}

app.use(requireLogin);
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});