require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");
const Product = require("./models/Product");

async function createSampleData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB");

    // Create sample mechanics with different specialties
    const mechanics = [
      {
        name: "أحمد محمد",
        email: "ahmed.mechanic@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201091234567",
        location: "أسوان، حي الصداقة",
        skills: ["محرك", "صيانة عامة"],
        specialty: "محرك",
        experienceYears: 8,
        rating: 4.8,
        completedBookings: 120,
        availabilityStatus: "available",
        latitude: 24.0889,
        longitude: 32.8998,
        bio: "متخصص في إصلاح المحركات وصيانتها"
      },
      {
        name: "محمد علي",
        email: "mohamed.electric@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201097654321",
        location: "أسوان، حي السلام",
        skills: ["كهرباء", "صيانة عامة"],
        specialty: "كهرباء",
        experienceYears: 6,
        rating: 4.9,
        completedBookings: 95,
        availabilityStatus: "available",
        latitude: 24.0789,
        longitude: 32.8898,
        bio: "متخصص في الأنظمة الكهربائية والبطاريات"
      },
      {
        name: "فاطمة أحمد",
        email: "fatima.tires@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201098765432",
        location: "أسوان، وسط المدينة",
        skills: ["إطارات", "صيانة عامة"],
        specialty: "إطارات",
        experienceYears: 5,
        rating: 4.7,
        completedBookings: 80,
        availabilityStatus: "available",
        latitude: 24.0989,
        longitude: 32.9098,
        bio: "متخصصة في إصلاح وتغيير الإطارات"
      },
      {
        name: "خالد حسن",
        email: "khaled.brakes@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201099876543",
        location: "أسوان، حي النصر",
        skills: ["فرامل", "صيانة عامة"],
        specialty: "فرامل",
        experienceYears: 7,
        rating: 4.6,
        completedBookings: 110,
        availabilityStatus: "available",
        latitude: 24.1089,
        longitude: 32.9198,
        bio: "متخصص في أنظمة الفرامل والتوقف"
      },
      {
        name: "سارة عبدالله",
        email: "sara.ac@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201096543210",
        location: "أسوان، الكورنيش",
        skills: ["تكييف", "صيانة عامة"],
        specialty: "تكييف",
        experienceYears: 4,
        rating: 4.5,
        completedBookings: 65,
        availabilityStatus: "available",
        latitude: 24.0689,
        longitude: 32.8798,
        bio: "متخصصة في أنظمة التكييف والتبريد"
      },
      {
        name: "يوسف إبراهيم",
        email: "youssef.transmission@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201095432109",
        location: "أسوان، حي الجامعة",
        skills: ["جير", "صيانة عامة"],
        specialty: "جير",
        experienceYears: 9,
        rating: 4.9,
        completedBookings: 140,
        availabilityStatus: "available",
        latitude: 24.1189,
        longitude: 32.9298,
        bio: "متخصص في صناديق التروس وناقل الحركة"
      },
      {
        name: "نور الدين",
        email: "nour.suspension@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201094321098",
        location: "أسوان، شارع السوق",
        skills: ["تعليق", "صيانة عامة"],
        specialty: "تعليق",
        experienceYears: 6,
        rating: 4.7,
        completedBookings: 88,
        availabilityStatus: "available",
        latitude: 24.0589,
        longitude: 32.8698,
        bio: "متخصص في أنظمة التعليق والمساعدين"
      },
      {
        name: "مريم سعيد",
        email: "mariam.general@email.com",
        password: "mechanic123",
        role: "mechanic",
        phone: "+201093210987",
        location: "أسوان، حي الشباب",
        skills: ["صيانة عامة"],
        specialty: "صيانة عامة",
        experienceYears: 3,
        rating: 4.4,
        completedBookings: 45,
        availabilityStatus: "available",
        latitude: 24.1289,
        longitude: 32.9398,
        bio: "ميكانيكي عام لجميع أنواع الصيانة"
      }
    ];

    console.log("Creating sample mechanics...");
    for (const mechanic of mechanics) {
      const existingMechanic = await User.findOne({ email: mechanic.email });
      if (!existingMechanic) {
        const newMechanic = new User(mechanic);
        await newMechanic.save();
        console.log(`✅ Created mechanic: ${mechanic.name} (${mechanic.specialty})`);
      } else {
        console.log(`⚠️  Mechanic already exists: ${mechanic.name}`);
      }
    }

    // Create sample workshop
    const workshop = {
      name: "مركز صيانة أسوان",
      email: "workshop@aswan.com",
      password: "workshop123",
      role: "workshop",
      phone: "+201055555555",
      location: "أسوان، شارع النيل",
      workshopName: "مركز صيانة أسوان المتطور",
      latitude: 24.0889,
      longitude: 32.8998
    };

    console.log("Creating sample workshop...");
    let workshopUser = await User.findOne({ email: workshop.email });
    if (!workshopUser) {
      const newWorkshop = new User(workshop);
      workshopUser = await newWorkshop.save();
      console.log(`✅ Created workshop: ${workshop.workshopName}`);
    } else {
      console.log(`⚠️  Workshop already exists: ${workshop.workshopName}`);
    }

    // Create sample products
    const products = [
      {
        name: "زيت محرك تويوتا أصلي",
        price: 150,
        category: "زيوت",
        description: "زيت محرك أصلي لسيارات تويوتا، مضمون الجودة",
        stock: 50,
        inStock: true,
        brand: "تويوتا",
        images: ["/uploads/engine-oil.jpg"],
        userId: workshopUser._id
      },
      {
        name: "فلتر هواء أصلي",
        price: 80,
        category: "فلاتر",
        description: "فلتر هواء عالي الكفاءة لجميع أنواع السيارات",
        stock: 30,
        inStock: true,
        brand: "مرسيدس",
        images: ["/uploads/air-filter.jpg"],
        userId: workshopUser._id
      },
      {
        name: "بطارية سيارة 12 فولت",
        price: 450,
        category: "بطاريات",
        description: "بطارية سيارة قوية وعالية السعة",
        stock: 15,
        inStock: true,
        brand: "فارتا",
        images: ["/uploads/battery.jpg"],
        userId: workshopUser._id
      },
      {
        name: "إطار سيارة 205/55R16",
        price: 350,
        category: "إطارات",
        description: "إطار سيارة عالي الجودة مقاوم للانزلاق",
        stock: 20,
        inStock: true,
        brand: "ميشلان",
        images: ["/uploads/tire.jpg"],
        userId: workshopUser._id
      }
    ];

    console.log("Creating sample products...");
    for (const product of products) {
      const existingProduct = await Product.findOne({ name: product.name });
      if (!existingProduct) {
        const newProduct = new Product(product);
        await newProduct.save();
        console.log(`✅ Created product: ${product.name}`);
      } else {
        console.log(`⚠️  Product already exists: ${product.name}`);
      }
    }

    console.log("\n🎉 Sample data created successfully!");
    console.log("\n📋 Login Credentials:");
    console.log("Admin: admin@admin.com / admin123");
    console.log("\nMechanics:");
    mechanics.forEach(m => {
      console.log(`${m.name} (${m.specialty}): ${m.email} / mechanic123`);
    });
    console.log("\nWorkshop: workshop@aswan.com / workshop123");

  } catch (error) {
    console.error("❌ Error creating sample data:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  }
}

createSampleData();