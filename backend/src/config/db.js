const mongoose = require('mongoose');

let mongodInstance = null;

async function connectDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/session-firewall';
  
  // Try connecting to provided URI first
  try {
    console.log(`[DB] Attempting connection to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log('[DB] Successfully connected to MongoDB server');
    return;
  } catch (err) {
    console.warn(`[DB] Local MongoDB not reachable (${err.message}). Attempting embedded in-memory MongoDB fallback...`);
  }

  // Fallback: mongodb-memory-server
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongodInstance = await MongoMemoryServer.create();
    const memoryUri = mongodInstance.getUri();
    console.log(`[DB] Started in-memory MongoDB instance at ${memoryUri}`);
    await mongoose.connect(memoryUri);
    console.log('[DB] Successfully connected to in-memory MongoDB');
  } catch (memErr) {
    console.error('[DB] Failed to launch mongodb-memory-server:', memErr.message);
    throw new Error('Could not connect to MongoDB or in-memory fallback. Please verify environment.');
  }
}

async function closeDB() {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}

module.exports = { connectDB, closeDB };
