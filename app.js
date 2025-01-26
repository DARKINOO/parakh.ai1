const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const app = express();
const connectToDb = require('./db/db');
const corsConfig = require('./middlewares/corsConfig');
const userRoutes = require('./routes/user.routes');

// Database connection
connectToDb();

// Centralized middleware
app.use(corsConfig);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const resumeRoutes = require('./routes/resumeRoutes');
app.use('/api/resume', resumeRoutes);


app.use('/api/user', userRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('Resume AI Backend');
});

module.exports = app;