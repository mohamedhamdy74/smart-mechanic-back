// Quick seed to MongoDB Atlas
const mongoose = require('mongoose');
const User = require('./models/User');
const Product = require('./models/Product');
require('dotenv').config();

const ATLAS_URI = process.env.MONGO_URI;

async function quickSeed() {
    try {
        console.log('🔄 Connecting to Atlas...');
        await mongoose.connect(ATLAS_URI);
        console.log('✅ Connected!\n');

        // Admin
        if (!(await User.findOne({ email: 'admin@admin.com' }))) {
            await new User({
                name: 'Admin', email: 'admin@admin.com', password: 'admin123',
                role: 'admin', phone: '+201000000000', location: 'أسوان',
                latitude: 24.0889, longitude: 32.8998
            }).save();
            console.log('✅ Admin created');
        }

        // Mechanics
        const mechanics = [
            { name: 'أحمد محمد', email: 'ahmed@m.com', specialty: 'محرك', skills: ['محرك'], rating: 4.8, completedBookings: 120 },
            { name: 'محمد علي', email: 'mohamed@m.com', specialty: 'كهرباء', skills: ['كهرباء'], rating: 4.9, completedBookings: 95 },
            { name: 'فاطمة أحمد', email: 'fatima@m.com', specialty: 'إطارات', skills: ['إطارات'], rating: 4.7, completedBookings: 80 },
            { name: 'خالد حسن', email: 'khaled@m.com', specialty: 'فرامل', skills: ['فرامل'], rating: 4.6, completedBookings: 110 },
            { name: 'سارة عبدالله', email: 'sara@m.com', specialty: 'تكييف', skills: ['تكييف'], rating: 4.5, completedBookings: 65 },
            { name: 'يوسف إبراهيم', email: 'youssef@m.com', specialty: 'جير', skills: ['جير'], rating: 4.9, completedBookings: 140 }
        ];

        for (const m of mechanics) {
            if (!(await User.findOne({ email: m.email }))) {
                await new User({
                    ...m, password: 'mechanic123', role: 'mechanic',
                    phone: '+201099999999', location: 'أسوان', availabilityStatus: 'available',
                    latitude: 24.0889, longitude: 32.8998, experienceYears: 5,
                    bio: `متخصص في ${m.specialty}`
                }).save();
                console.log(`✅ ${m.name}`);
            }
        }

        // Workshop
        let workshop = await User.findOne({ email: 'workshop@aswan.com' });
        if (!workshop) {
            workshop = await new User({
                name: 'مركز صيانة أسوان', email: 'workshop@aswan.com', password: 'workshop123',
                role: 'workshop', phone: '+201055555555', location: 'أسوان',
                workshopName: 'مركز صيانة أسوان', latitude: 24.0889, longitude: 32.8998
            }).save();
            console.log('✅ Workshop created');
        }

        // Products
        const products = [
            { name: 'زيت محرك', price: 150, category: 'زيوت', stock: 50 },
            { name: 'فلتر هواء', price: 80, category: 'فلاتر', stock: 30 },
            { name: 'بطارية 12V', price: 450, category: 'بطاريات', stock: 15 },
            { name: 'إطار 205/55R16', price: 350, category: 'إطارات', stock: 20 }
        ];

        for (const p of products) {
            if (!(await Product.findOne({ name: p.name }))) {
                await new Product({
                    ...p, inStock: true, description: p.name,
                    images: ['/uploads/default.jpg'], userId: workshop._id
                }).save();
                console.log(`✅ ${p.name}`);
            }
        }

        console.log('\n🎉 Seeding completed!');
        console.log('\n📋 Credentials:');
        console.log('Admin: admin@admin.com / admin123');
        console.log('Workshop: workshop@aswan.com / workshop123');
        console.log('Mechanics: all use mechanic123\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

quickSeed();
