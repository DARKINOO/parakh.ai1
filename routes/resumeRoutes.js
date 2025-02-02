// resumeRoutes.js
const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const upload = require('../middlewares/uploadMiddleware');

// Resume submission routes
router.post('/submit-resume', upload.single('resume'), resumeController.submitResume);

router.get('/interview/:resumeId', async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await resume.findById(resumeId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        res.json(resume);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Interview question routes
router.post('/latest-resume', resumeController.getLatestResume);
// In resumeRoutes.js
router.get('/interview-questions', resumeController.getInterviewQuestions);
router.get('/interview-questions/:resumeId', resumeController.getInterviewQuestions);
// router.post('/evaluate-answer', resumeController.evaluateAnswer);
router.post('/submit-full-interview', resumeController.submitFullInterview);

module.exports = router;