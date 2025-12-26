const cron = require('node-cron');
const MaintenancePlan = require('../models/MaintenancePlan');
const Notification = require('../models/Notification');

/**
 * Calculate task status based on days remaining
 * @param {Date} dueDate - Task due date
 * @returns {string} - Task status (pending, due_soon, overdue, completed)
 */
const calculateTaskStatus = (dueDate) => {
    const now = new Date();
    const timeDiff = dueDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
        return 'overdue';
    } else if (daysRemaining <= 7) {
        return 'due_soon';
    } else {
        return 'pending';
    }
};

/**
 * Send maintenance notification to user
 * @param {string} userId - User ID
 * @param {Object} task - Maintenance task
 */
const sendMaintenanceNotification = async (userId, task) => {
    try {
        const now = new Date();
        const timeDiff = task.dueDate.getTime() - now.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        let title, message;

        if (daysRemaining < 0) {
            title = 'تحذير: صيانة متأخرة!';
            message = `مهمة "${task.task}" متأخرة عن موعدها المحدد. يرجى إجراء الصيانة في أقرب وقت ممكن.`;
        } else if (daysRemaining === 0) {
            title = 'تذكير: صيانة اليوم!';
            message = `مهمة "${task.task}" مستحقة اليوم. لا تنسى إجراء الصيانة.`;
        } else if (daysRemaining <= 3) {
            title = 'تنبيه: صيانة قريبة!';
            message = `مهمة "${task.task}" مستحقة خلال ${daysRemaining} أيام. استعد لإجراء الصيانة.`;
        } else if (daysRemaining <= 7) {
            title = 'تذكير: صيانة قادمة';
            message = `مهمة "${task.task}" مستحقة خلال ${daysRemaining} أيام.`;
        }

        if (title && message) {
            const notification = new Notification({
                recipientId: userId,
                type: 'maintenance_reminder',
                title,
                message,
                data: {
                    taskId: task._id,
                    taskName: task.task,
                    dueDate: task.dueDate,
                    daysRemaining
                }
            });

            await notification.save();
            console.log(`✅ Notification sent to user ${userId} for task: ${task.task}`);
        }
    } catch (error) {
        console.error('Error sending maintenance notification:', error);
    }
};

/**
 * Check all maintenance tasks and update statuses
 * Send notifications for tasks that are due soon
 */
const checkMaintenanceTasks = async () => {
    try {
        console.log('🔍 Checking maintenance tasks...');

        // Find all maintenance plans
        const plans = await MaintenancePlan.find({});

        let tasksChecked = 0;
        let notificationsSent = 0;
        let statusesUpdated = 0;

        for (const plan of plans) {
            let planUpdated = false;

            for (const task of plan.upcoming) {
                tasksChecked++;

                // Skip completed tasks
                if (task.status === 'completed') {
                    continue;
                }

                // Calculate new status
                const newStatus = calculateTaskStatus(task.dueDate);

                // Update status if changed
                if (task.status !== newStatus) {
                    task.status = newStatus;
                    planUpdated = true;
                    statusesUpdated++;
                }

                // Send notification if task is due soon and notification not sent yet
                const now = new Date();
                const timeDiff = task.dueDate.getTime() - now.getTime();
                const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

                // Send notification for tasks due within 7 days or overdue
                if ((daysRemaining <= 7 || daysRemaining < 0) && !task.notificationSent) {
                    await sendMaintenanceNotification(plan.userId, task);
                    task.notificationSent = true;
                    planUpdated = true;
                    notificationsSent++;
                }
            }

            // Save plan if any task was updated
            if (planUpdated) {
                await plan.save();
            }
        }

        console.log(`✅ Maintenance check complete: ${tasksChecked} tasks checked, ${statusesUpdated} statuses updated, ${notificationsSent} notifications sent`);
    } catch (error) {
        console.error('❌ Error checking maintenance tasks:', error);
    }
};

/**
 * Start the maintenance scheduler
 * Runs every hour to check maintenance tasks
 */
const startMaintenanceScheduler = () => {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', () => {
        console.log('⏰ Running scheduled maintenance check...');
        checkMaintenanceTasks();
    });

    console.log('🚀 Maintenance scheduler started - will run every hour');

    // Run immediately on startup
    checkMaintenanceTasks();
};

module.exports = {
    startMaintenanceScheduler,
    checkMaintenanceTasks,
    calculateTaskStatus,
    sendMaintenanceNotification
};
