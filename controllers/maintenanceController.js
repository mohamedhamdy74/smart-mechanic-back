const MaintenanceLog = require("../models/MaintenanceLog");
const MaintenancePlan = require("../models/MaintenancePlan");
const Car = require("../models/Car");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { generateMaintenancePlan } = require("../services/geminiService");

/**
 * Helper to find or create car for user
 * Prioritizes:
 * 1. Existing Car record
 * 2. Car details from User profile
 * 3. Car details from recent Bookings
 * 4. Default fallback (Toyota Corolla)
 */
const findOrCreateCar = async (userId) => {
    // 1. Try to find existing car
    let car = await Car.findOne({ userId });
    if (car) return car;

    console.log(`Car not found for userId: ${userId}. Attempting to discover car details...`);

    // 2. Try to find car details in User profile
    const user = await User.findById(userId);
    if (user && user.carBrand && user.carModel) {
        console.log("Found car details in User profile");
        car = new Car({
            userId,
            make: user.carBrand,
            model: user.carModel,
            year: parseInt(user.carYear) || 2020,
            vin: `Generated-${Date.now()}`,
            licensePlate: user.plateNumber || `TEMP-${Math.floor(Math.random() * 10000)}`,
            color: "Unknown",
            mileage: user.mileage || 0,
            fuelType: "Petrol",
            transmission: "Automatic",
            engineCapacity: "1.6L",
            ownershipStatus: "Owned"
        });
        await car.save();
        return car;
    }

    // 3. Try to find car details in recent Bookings
    const lastBooking = await Booking.findOne({ customerId: userId }).sort({ createdAt: -1 });
    if (lastBooking && lastBooking.carInfo) {
        console.log("Found car details in recent Booking");
        // Try to parse "Make Model Year" or similar
        // Example: "Toyota Corolla 2020"
        const parts = lastBooking.carInfo.split(' ');
        const make = parts[0] || "Unknown";
        const model = parts.slice(1).join(' ') || "Unknown";

        car = new Car({
            userId,
            make: make,
            model: model,
            year: 2020, // Default if not found in string
            vin: `Generated-${Date.now()}`,
            licensePlate: lastBooking.licensePlate || `TEMP-${Math.floor(Math.random() * 10000)}`,
            color: "Unknown",
            mileage: 0,
            fuelType: "Petrol",
            transmission: "Automatic",
            engineCapacity: "1.6L",
            ownershipStatus: "Owned"
        });
        await car.save();
        return car;
    }

    // 4. Fallback to Default Car
    console.log("No car details found. Creating default car.");
    car = new Car({
        userId,
        make: "Toyota",
        model: "Corolla",
        year: 2022,
        vin: `DEFAULT-${Date.now()}`,
        licensePlate: `TEMP-${Math.floor(Math.random() * 10000)}`,
        color: "White",
        mileage: 0,
        fuelType: "Petrol",
        transmission: "Automatic",
        engineCapacity: "1.6L",
        ownershipStatus: "Owned"
    });
    await car.save();
    return car;
};

/**
 * Generate maintenance plan using AI
 * POST /maintenance/generate
 */
exports.generatePlan = async (req, res) => {
    try {
        // Get userId from authenticated user token
        const userId = req.user.id || req.user._id;
        console.log("Generating plan for userId:", userId);

        // Fetch or create car
        const car = await findOrCreateCar(userId);

        // Fetch maintenance logs
        const logs = await MaintenanceLog.find({ userId }).sort({ date: -1 });

        // Prepare car data for AI
        const carData = {
            make: car.make,
            model: car.model,
            year: car.year,
            mileage: car.mileage || 0,
            fuelType: car.fuelType,
            transmission: car.transmission,
            engineCapacity: car.engineCapacity,
        };

        // Generate AI plan
        const aiPlan = await generateMaintenancePlan(carData, logs);

        // Calculate dueDate and status for each task
        const upcomingWithDates = aiPlan.upcoming.map(task => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + task.estimatedDays);

            // Calculate initial status
            const now = new Date();
            const timeDiff = dueDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            let status = 'pending';
            if (daysRemaining < 0) {
                status = 'overdue';
            } else if (daysRemaining <= 7) {
                status = 'due_soon';
            }

            return {
                ...task,
                dueDate,
                status,
                notificationSent: false
            };
        });

        // Save plan to database
        const plan = new MaintenancePlan({
            userId,
            upcoming: upcomingWithDates,
            warnings: aiPlan.warnings,
            recommended: aiPlan.recommended,
            carHealthScore: aiPlan.carHealthScore,
        });

        await plan.save();

        res.status(200).json({
            message: "Maintenance plan generated successfully",
            plan,
        });
    } catch (error) {
        console.error("Error generating maintenance plan:", error);
        res.status(500).json({
            message: "Failed to generate maintenance plan",
            error: error.message,
        });
    }
};

/**
 * Get latest maintenance plan for a user
 * GET /maintenance/plan/:userId
 */
exports.getPlan = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find the latest plan for this user
        const plan = await MaintenancePlan.findOne({ userId }).sort({ createdAt: -1 });

        if (!plan) {
            return res.status(404).json({ message: "No maintenance plan found for this user" });
        }

        res.status(200).json({ plan });
    } catch (error) {
        console.error("Error fetching maintenance plan:", error);
        res.status(500).json({
            message: "Failed to fetch maintenance plan",
            error: error.message,
        });
    }
};

/**
 * Add maintenance log entry and regenerate plan
 * POST /maintenance/log
 */
exports.addLog = async (req, res) => {
    try {
        console.log("addLog controller called with body:", req.body);
        const { task, date, km } = req.body;
        // Get userId from authenticated user token
        const userId = req.user.id || req.user._id;
        console.log("Generating plan for userId:", userId);

        if (!task || !date || !km) {
            console.log("Missing required fields");
            return res.status(400).json({
                message: "task, date, and km are required",
            });
        }

        // Create new maintenance log
        const log = new MaintenanceLog({
            userId,
            task,
            date: new Date(date),
            km,
        });

        await log.save();
        console.log("Log saved successfully");

        // Fetch or create car
        const car = await findOrCreateCar(userId);
        console.log("Car found/created:", car._id);

        // Update mileage if provided in log
        if (km > (car.mileage || 0)) {
            car.mileage = km;
            await car.save();
        }

        // Fetch all logs including the new one
        const logs = await MaintenanceLog.find({ userId }).sort({ date: -1 });

        // Prepare car data for AI
        const carData = {
            make: car.make,
            model: car.model,
            year: car.year,
            mileage: car.mileage || 0,
            fuelType: car.fuelType,
            transmission: car.transmission,
            engineCapacity: car.engineCapacity,
        };

        // Regenerate AI plan
        const aiPlan = await generateMaintenancePlan(carData, logs);

        // Calculate dueDate and status for each task
        const upcomingWithDates = aiPlan.upcoming.map(task => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + task.estimatedDays);

            // Calculate initial status
            const now = new Date();
            const timeDiff = dueDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            let status = 'pending';
            if (daysRemaining < 0) {
                status = 'overdue';
            } else if (daysRemaining <= 7) {
                status = 'due_soon';
            }

            return {
                ...task,
                dueDate,
                status,
                notificationSent: false
            };
        });

        // Save updated plan
        const plan = new MaintenancePlan({
            userId,
            upcoming: upcomingWithDates,
            warnings: aiPlan.warnings,
            recommended: aiPlan.recommended,
            carHealthScore: aiPlan.carHealthScore,
        });

        await plan.save();

        res.status(201).json({
            message: "Maintenance log added and plan updated successfully",
            log,
            plan,
        });
    } catch (error) {
        console.error("Error adding maintenance log:", error);
        res.status(500).json({
            message: "Failed to add maintenance log",
            error: error.message,
        });
    }
};

/**
 * Update car mileage and regenerate plan
 * PATCH /maintenance/update-km
 */
exports.updateMileage = async (req, res) => {
    try {
        const { mileage } = req.body;
        // Get userId from authenticated user token
        const userId = req.user.id || req.user._id;

        if (mileage === undefined) {
            return res.status(400).json({
                message: "mileage is required",
            });
        }

        // Fetch or create car
        const car = await findOrCreateCar(userId);

        // Update mileage
        car.mileage = mileage;
        await car.save();

        // Fetch maintenance logs
        const logs = await MaintenanceLog.find({ userId }).sort({ date: -1 });

        // Prepare car data for AI
        const carData = {
            make: car.make,
            model: car.model,
            year: car.year,
            mileage: car.mileage,
            fuelType: car.fuelType,
            transmission: car.transmission,
            engineCapacity: car.engineCapacity,
        };

        // Regenerate AI plan with updated mileage
        const aiPlan = await generateMaintenancePlan(carData, logs);

        // Calculate dueDate and status for each task
        const upcomingWithDates = aiPlan.upcoming.map(task => {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + task.estimatedDays);

            // Calculate initial status
            const now = new Date();
            const timeDiff = dueDate.getTime() - now.getTime();
            const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

            let status = 'pending';
            if (daysRemaining < 0) {
                status = 'overdue';
            } else if (daysRemaining <= 7) {
                status = 'due_soon';
            }

            return {
                ...task,
                dueDate,
                status,
                notificationSent: false
            };
        });

        // Save updated plan
        const plan = new MaintenancePlan({
            userId,
            upcoming: upcomingWithDates,
            warnings: aiPlan.warnings,
            recommended: aiPlan.recommended,
            carHealthScore: aiPlan.carHealthScore,
        });

        await plan.save();

        res.status(200).json({
            message: "Mileage updated and plan regenerated successfully",
            car,
            plan,
        });
    } catch (error) {
        console.error("Error updating mileage:", error);
        res.status(500).json({
            message: "Failed to update mileage",
            error: error.message,
        });
    }
};

/**
 * Get upcoming maintenance tasks with their current status
 * GET /maintenance/upcoming
 */
exports.getUpcomingTasks = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        // Find the latest plan for this user
        const plan = await MaintenancePlan.findOne({ userId }).sort({ createdAt: -1 });

        if (!plan) {
            return res.status(404).json({ message: "No maintenance plan found for this user" });
        }

        // Filter out completed tasks and return only upcoming ones
        const upcomingTasks = plan.upcoming.filter(task => task.status !== 'completed');

        res.status(200).json({
            tasks: upcomingTasks,
            totalTasks: upcomingTasks.length
        });
    } catch (error) {
        console.error("Error fetching upcoming tasks:", error);
        res.status(500).json({
            message: "Failed to fetch upcoming tasks",
            error: error.message,
        });
    }
};

/**
 * Mark a maintenance task as completed
 * PATCH /maintenance/task/:planId/:taskId/complete
 */
exports.completeTask = async (req, res) => {
    try {
        const { planId, taskId } = req.params;
        const userId = req.user.id || req.user._id;

        // Find the plan
        const plan = await MaintenancePlan.findOne({ _id: planId, userId });

        if (!plan) {
            return res.status(404).json({ message: "Maintenance plan not found" });
        }

        // Find the task
        const task = plan.upcoming.id(taskId);

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        // Update task status
        task.status = 'completed';
        await plan.save();

        res.status(200).json({
            message: "Task marked as completed successfully",
            task
        });
    } catch (error) {
        console.error("Error completing task:", error);
        res.status(500).json({
            message: "Failed to complete task",
            error: error.message,
        });
    }
};
