// resumeRoutes.js
const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const upload = require('../middlewares/uploadMiddleware');

// Resume submission routes
router.post('/submit-resume', upload.single('resume'), resumeController.submitResume);

// Interview question routes
router.post('/latest-resume', resumeController.getLatestResume);
// In resumeRoutes.js
router.get('/interview-questions', resumeController.getInterviewQuestions);
router.get('/interview-questions/:resumeId', resumeController.getInterviewQuestions);
// router.post('/evaluate-answer', resumeController.evaluateAnswer);
router.post('/submit-full-interview', resumeController.submitFullInterview);

module.exports = router;