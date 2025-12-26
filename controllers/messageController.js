const Message = require("../models/Message");
const User = require("../models/User");
const mongoose = require("mongoose");

// Create a new message
const createMessage = async (req, res) => {
  try {
    const { chatRoomId, receiverId, messageText, messageType = "text" } = req.body;
    const senderId = req.user.id;

    // Validate required fields
    if (!chatRoomId || !receiverId || !messageText) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: chatRoomId, receiverId, messageText",
      });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    // Create message
    const message = new Message({
      chatRoomId,
      senderId,
      receiverId,
      messageText,
      messageType,
    });

    await message.save();

    // Populate sender info for response
    await message.populate("senderId", "name email");
    await message.populate("receiverId", "name email");

    // Create notification for the receiver (database only, no Socket.IO to avoid duplicates)
    try {
      const Notification = require("../models/Notification");
      const senderName = message.senderId.name || "مستخدم";

      const notification = new Notification({
        recipientId: receiverId,
        type: 'new_message',
        title: 'رسالة جديدة',
        message: `لديك رسالة جديدة من ${senderName}`,
        data: {
          chatRoomId,
          senderId,
          senderName,
          messagePreview: messageText.substring(0, 50)
        }
      });

      await notification.save();
      console.log('Message notification created for user:', receiverId);

      // Emit real-time notification to receiver (for the bell)
      if (global.emitNotificationToUser) {
        global.emitNotificationToUser(receiverId, {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt,
          read: false
        });
      }

    } catch (notifError) {
      console.error("Error creating message notification:", notifError);
      // Don't fail the message send if notification fails
    }

    // Emit real-time message to receiver
    if (global.io) {
      global.io.to(receiverId).emit("receive_message", message);
      console.log(`Socket message emitted to ${receiverId}`);
    } else {
      console.warn("Socket.io not initialized globally");
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get messages for a chat room
const getMessages = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user.id;

    if (!chatRoomId) {
      return res.status(400).json({
        success: false,
        message: "Chat room ID is required",
      });
    }

    // Get messages where user is either sender or receiver
    const messages = await Message.find({
      chatRoomId,
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .populate("senderId", "name email role")
      .populate("receiverId", "name email role")
      .sort({ createdAt: 1 });

    // Mark messages as read if user is the receiver
    await Message.updateMany(
      {
        chatRoomId,
        receiverId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get chat rooms for a user
const getUserChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get all unique chat rooms where user is involved
    const chatRooms = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userObjectId }, { receiverId: userObjectId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$chatRoomId",
          lastMessage: { $first: "$$ROOT" },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", userObjectId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.senderId",
          foreignField: "_id",
          as: "senderInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.receiverId",
          foreignField: "_id",
          as: "receiverInfo",
        },
      },
      {
        $project: {
          chatRoomId: "$_id",
          lastMessage: {
            _id: "$lastMessage._id",
            messageText: "$lastMessage.messageText",
            createdAt: "$lastMessage.createdAt",
            senderId: "$lastMessage.senderId",
            receiverId: "$lastMessage.receiverId",
          },
          senderInfo: { $arrayElemAt: ["$senderInfo", 0] },
          receiverInfo: { $arrayElemAt: ["$receiverInfo", 0] },
          unreadCount: 1,
        },
      },
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);

    // Format response
    const formattedChatRooms = chatRooms.map((room) => {
      const otherUser =
        room.senderInfo._id.toString() === userId
          ? room.receiverInfo
          : room.senderInfo;

      return {
        chatRoomId: room.chatRoomId,
        otherUser: {
          _id: otherUser._id,
          name: otherUser.name,
          email: otherUser.email,
          role: otherUser.role,
        },
        lastMessage: room.lastMessage,
        unreadCount: room.unreadCount,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedChatRooms,
    });
  } catch (error) {
    console.error("Error getting user chat rooms:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Mark messages as read in a chat room
const markMessagesAsRead = async (req, res) => {
  try {
    const { chatRoomId } = req.params;
    const userId = req.user.id;

    if (!chatRoomId) {
      return res.status(400).json({
        success: false,
        message: "Chat room ID is required",
      });
    }

    const result = await Message.updateMany(
      {
        chatRoomId,
        receiverId: userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} messages marked as read`,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get unread message count for user
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const unreadCount = await Message.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  createMessage,
  getMessages,
  getUserChatRooms,
  markMessagesAsRead,
  getUnreadCount,
};