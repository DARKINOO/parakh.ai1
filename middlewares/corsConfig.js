const cors = require('cors');

const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',    // Vite default frontend port
            'http://127.0.0.1:5173',    // Localhost alternative
            'http://localhost:5174',    // Your actual frontend port
            'http://127.0.0.1:5174',
            'https://parakhai-1.vercel.app/'     // Localhost alternative
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Origin'
    ],
    credentials: true,
    optionsSuccessStatus: 200  // Some legacy browsers choke on 204
};

module.exports = cors(corsOptions);