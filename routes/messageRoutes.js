const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const auth = require("../middlewares/auth");

// All message routes require authentication
router.use(auth.authenticate);

// Create a new message
router.post("/", messageController.createMessage);

// Get messages for a chat room
router.get("/:chatRoomId", messageController.getMessages);

// Get chat rooms for authenticated user
router.get("/", messageController.getUserChatRooms);

// Mark messages as read in a chat room
router.patch("/:chatRoomId/read", messageController.markMessagesAsRead);

// Get unread message count for user
router.get("/unread/count", messageController.getUnreadCount);

module.exports = router;