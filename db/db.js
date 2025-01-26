const mongoose = require('mongoose');

function connectTOdb() {
    mongoose.connect(process.env.DB_URI);
    const db = mongoose.connection;
    db.on('error', (error) => console.error(error));
    db.once('open', () => console.log('Connected to database'));
}

module.exports = connectTOdb;