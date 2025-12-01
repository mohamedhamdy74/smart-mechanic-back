const express = require("express");
const router = express.Router();
const aiController = require("../controllers/aiController");
const { authenticate } = require("../middlewares/auth");
const multer = require("multer");

// Configure multer for memory storage (to send buffer to HF)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image or audio files allowed'), false);
    }
  }
});

// AI Diagnosis endpoint - requires authentication
router.post("/diagnose", authenticate, upload.single('file'), aiController.diagnose);

// Get diagnosis history (future implementation)
router.get("/diagnoses", authenticate, aiController.getDiagnosisHistory);

module.exports = router;