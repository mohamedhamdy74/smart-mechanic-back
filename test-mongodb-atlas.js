require('dotenv').config();
const mongoose = require('mongoose');

// MongoDB Atlas URI
const MONGO_URI = process.env.MONGO_URI;

async function testConnection() {
    try {
        console.log('🔄 Connecting to MongoDB Atlas...');

        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Successfully connected to MongoDB Atlas!');
        console.log('📊 Database:', mongoose.connection.name);
        console.log('🌐 Host:', mongoose.connection.host);

        // Test a simple query
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📁 Collections found: ${collections.length}`);
        collections.forEach(col => console.log(`   - ${col.name}`));

        await mongoose.connection.close();
        console.log('✅ Connection test completed successfully!');

    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        process.exit(1);
    }
}

testConnection();
