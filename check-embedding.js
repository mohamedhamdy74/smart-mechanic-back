require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('Connected to DB');
        const user = await User.findOne({ email: 'testmech_persist@example.com' });
        if (user) {
            console.log('User found:', user.name);
            if (user.mechanicProfileEmbedding && user.mechanicProfileEmbedding.length > 0) {
                console.log('✅ Embedding found with length:', user.mechanicProfileEmbedding.length);
            } else {
                console.log('❌ Embedding missing or empty');
                console.log('Role:', user.role);
                console.log('Skills:', user.skills);
                console.log('Specialty:', user.specialty);
            }
        } else {
            console.log('User not found');
        }
        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
