require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const { runSeed } = require('./config/seed');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const bankRoutes = require('./routes/bank');
const adminRoutes = require('./routes/admin');
const demoRoutes = require('./routes/demo');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Session Firewall Banking Security Platform',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/demo', demoRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ServerError]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server & Auto-Seed
async function start() {
  try {
    await connectDB();

    // Check if initial users exist, otherwise auto-seed
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('[Server] Database is empty. Running initial demo seed...');
      await runSeed();
    } else {
      console.log(`[Server] Found ${userCount} existing users in database.`);
    }

    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  🛡️  Session Firewall Backend running on port ${PORT}`);
      console.log(`  🔗  API URL: http://localhost:${PORT}/api`);
      console.log(`  👤  Customer: customer@securebank.com / Password123!`);
      console.log(`  👮  Admin:    admin@securebank.com / AdminSecure123!`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
