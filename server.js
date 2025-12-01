require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:8085', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:8083', 'http://127.0.0.1:8085', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.1.7:8080', 'http://192.168.1.7:8081', 'http://192.168.1.7:8082', 'http://192.168.1.7:8083', 'http://192.168.1.7:8085', 'http://192.168.1.7:5173', 'exp://192.168.1.7:8081', 'http://10.171.240.181:8080', 'http://10.171.240.181:8081', 'http://10.171.240.181:8082', 'http://10.171.240.181:8083', 'http://10.171.240.181:8085', 'exp://10.171.240.181:8081'],
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const carRoutes = require("./routes/carRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const errorHandler = require("./middlewares/errorHandler");

// Middleware
const compressionMiddleware = require('./middlewares/compression');
const { apiLimiter, authLimiter, bookingLimiter, uploadLimiter } = require('./middlewares/rateLimiter');
const { cacheMiddleware } = require('./middlewares/caching');

app.use(compressionMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan("dev"));

// Configure CORS to allow requests from our frontend
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083', 'http://localhost:8085', 'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:8083', 'http://127.0.0.1:8085', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.1.7:8080', 'http://192.168.1.7:8081', 'http://192.168.1.7:8082', 'http://192.168.1.7:8083', 'http://192.168.1.7:8085', 'http://192.168.1.7:5173', 'exp://192.168.1.7:8081', 'http://10.171.240.181:8080', 'http://10.171.240.181:8081', 'http://10.171.240.181:8082', 'http://10.171.240.181:8083', 'http://10.171.240.181:8085', 'http://10.171.240.181:5173', 'exp://10.171.240.181:8081'],
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
}));

// Handle preflight requests
app.options('*', cors());

// Debug logging middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming request: ${req.method} ${req.url}`);
  next();
});

// Apply rate limiting
app.use('/auth', authLimiter);
// app.use('/bookings', bookingLimiter); // Temporarily disabled for development
app.use('/users/avatar', uploadLimiter);
app.use('/products', uploadLimiter);
app.use(apiLimiter);

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Root endpoint for basic connectivity check
app.get('/', (req, res) => {
  res.json({
    message: 'Car Maintenance API Server',
    status: 'Running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Apply caching to read-heavy routes with optimized TTL for better performance
// app.use('/users', cacheMiddleware(60)); // 60 seconds cache for user data - disabled for debugging
app.use('/products', cacheMiddleware(120)); // 120 seconds cache for products (less frequent changes)
app.use('/mechanics', cacheMiddleware(45)); // 45 seconds cache for mechanics

// Routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/cars", carRoutes);
app.use("/bookings", bookingRoutes);

// Add notification routes
const notificationRoutes = require("./routes/notificationRoutes");
app.use("/notifications", notificationRoutes);

// Cart routes (client)
const cartRoutes = require("./routes/cartRoutes");
app.use("/cart", cartRoutes);

// AI routes
const aiRoutes = require("./routes/aiRoutes");
app.use("/ai", aiRoutes);

// Maintenance routes
const maintenanceRoutes = require("./routes/maintenanceRoutes");
app.use("/maintenance", maintenanceRoutes);

// Admin routes
const adminRoutes = require("./routes/adminRoutes");
app.use("/admin", adminRoutes);

// Message routes
const messageRoutes = require("./routes/messageRoutes");
app.use("/messages", messageRoutes);

// Error Handler
app.use(errorHandler);

// Socket.IO connection handling
const connectedUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining their personal room
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(userId);
      connectedUsers.set(userId, socket.id);
      console.log(`User ${userId} joined their room`);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from connected users map
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

// Function to emit notifications to specific users
const emitNotificationToUser = (userId, notification) => {
  io.to(userId).emit('notification', notification);
  console.log(`Notification sent to user ${userId}:`, notification);
};

// Export the emit function for use in controllers
global.emitNotificationToUser = emitNotificationToUser;

// DB Connection & Server Start
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces to support localhost and specific IP
const MONGO_URI = process.env.MONGO_URI;

// MongoDB connection options
const dbOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  // Remove the deprecated options
  // useCreateIndex: true,
  // useFindAndModify: false
};

// Connect to MongoDB
mongoose.connect(MONGO_URI, dbOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
      console.log(`🔌 Socket.IO is ready for real-time connections`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('Please check if MongoDB is running and the connection string is correct.');
    process.exit(1);
  });

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to DB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from DB');
});

// Handle application termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Mongoose connection closed due to app termination');
  process.exit(0);
});
