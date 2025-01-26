const http = require('http');
const express = require('express');
const app = require('./app');
const cors = require('cors');
const corsConfig = require('./middlewares/corsConfig');
app.use(corsConfig);

// app.use(cors({
//     origin: [
//         'http://localhost:5173',    // Vite default frontend port
//         'http://127.0.0.1:5173',    // Localhost alternative
//         'http://localhost:4000',    // Matching backend port
//         'http://127.0.0.1:4000'     // Localhost alternative
//     ],
//     methods: ['GET', 'POST', 'PUT', 'DELETE'],
//     allowedHeaders: [
//         'Content-Type', 
//         'Authorization', 
//         'Access-Control-Allow-Headers',
//         'Access-Control-Allow-Origin'
//     ],
//     credentials: true,
//   }));

  app.options('*', cors());

// Middleware for parsing JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});