require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const users = await User.find({}, 'email role').limit(10);
        console.log('Users found:', users);
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

listUsers();
