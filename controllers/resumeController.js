const multer = require('multer');
const PDFParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const Resume = require('../models/Resume');
const InterviewPerformance = require('../models/InterviewPerfomance');
const upload = require('../middlewares/uploadMiddleware');
require('dotenv').config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

exports.submitResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const jobPreferences = JSON.parse(req.body.jobPreferences || '{}');

        // PDF Text Extraction
        let pdfText = '';
        try {
            const pdfBuffer = fs.readFileSync(file.path);
            const pdfParseResult = await PDFParse(pdfBuffer);
            pdfText = pdfParseResult.text;

            // Optional: Log extracted text for verification
            console.log('Extracted PDF Text:', pdfText.slice(0, 500)); // First 500 chars
        } catch (parseError) {
            console.error('PDF Parsing Error:', parseError);
            return res.status(400).json({ error: 'Could not parse PDF file' });
        }

        // Truncate text if too long
        const MAX_TEXT_LENGTH = 3000; // Adjust based on AI model limits
        const truncatedText = pdfText.slice(0, MAX_TEXT_LENGTH);

        // Generate interview questions using Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const prompt = `
            Generate 5 professional interview questions based on this resume:
            
            Resume Content:
            ${truncatedText}

            Job Preferences: ${JSON.stringify(jobPreferences)}

            Guidelines:
            1. Create targeted, role-specific questions
            2. Cover technical and behavioral aspects
            3. Relate questions to the resume's experience
            4. Ensure questions reveal candidate's capabilities

            also ensure that you only give me questions, no intro no outro, only start with questions
        `;

        const result = await model.generateContent(prompt);
        const interviewQuestions = result.response.text()
            .split('\n')
            .map(q => q.trim())
            .filter(q => q && q.length > 10); // Filter out very short or empty lines

        // Save resume and interview details
        const resumeEntry = new Resume({
            fileName: file.originalname,
            filePath: file.path,
            jobPreferences,
            interviewQuestions,
            submittedAt: new Date()
        });

        await resumeEntry.save();

        // Clean up uploaded file
        fs.unlinkSync(file.path);

        res.status(200).json({
            message: 'Resume submitted successfully',
            resumeId: resumeEntry._id,
            questions: interviewQuestions
        });

    } catch (error) {
        console.error('Detailed Resume Submission Error:', error);
        res.status(500).json({ 
            error: 'Resume submission failed',
            details: error.message 
        });
    }
};

exports.getLatestResume = async (req, res) => {
    try {
        const resume = await Resume.findOne().sort({ submittedAt: -1 });

        if (!resume) {
            return res.status(404).json({ 
                error: 'No resume found',
                message: 'Please submit a resume first' 
            });
        }

        res.json({ 
            resume,
            resumeId: resume._id 
        });

    } catch (error) {
        console.error('Latest Resume Retrieval Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}

// In resumeController.js
exports.getInterviewQuestions = async (req, res) => {
    try {
        const { resumeId } = req.params;
        
        // Find the most recent resume
        const resume = resumeId 
            ? await Resume.findById(resumeId)
            : await Resume.findOne().sort({ submittedAt: -1 });

        if (!resume) {
            return res.status(404).json({ 
                error: 'No resume found',
                message: 'Please submit a resume first' 
            });
        }

        // DEBUGGING: Extensive logging
        console.log('Resume Found:', resume._id);
        console.log('Interview Questions Raw:', resume.interviewQuestions);
        console.log('Interview Questions Type:', typeof resume.interviewQuestions);
        console.log('Interview Questions isArray:', Array.isArray(resume.interviewQuestions));

        // Ensure questions are always an array
        let questions = [];
        if (Array.isArray(resume.interviewQuestions)) {
            questions = resume.interviewQuestions.filter(q => q && q.trim() !== '');
        } else if (typeof resume.interviewQuestions === 'string') {
            // If it's a string, try to split it
            questions = resume.interviewQuestions
            .split('\n')
            .map(q => q.trim())
            .filter(q => q && q.length > 10);
        }

        // Fallback if no questions
        if (questions.length === 0) {
            questions = ['No interview questions available'];
        }

        // Ensure clean JSON response
        const responseData = {
            questions: questions,
            resumeId: resume._id.toString()
        };

        // DEBUGGING: Log response data
        console.log('Response Data:', JSON.stringify(responseData));

        res.json(responseData);

    } catch (error) {
        console.error('Detailed Interview Questions Error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            stack: error.stack 
        });
    }
};

exports.evaluateAnswer = async (req, res) => {
    try {
        const { resumeId, questionIndex, answer } = req.body;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const evaluationPrompt = `
            Evaluate the candidate's interview answer precisely:
            Candidate's Answer: ${answer}

            Evaluation Criteria:
            1. Clarity of Response
            2. Relevance to Question
            3. Depth of Insight
            4. Communication Skills

            Provide:
            - Detailed Score (0-10)
            - Specific, Constructive Feedback
            - Key Strengths
            - Areas for Improvement
        `;

        const result = await model.generateContent(evaluationPrompt);
        const evaluation = result.response.text();

        res.json({ 
            evaluation,
            score: Math.floor(Math.random() * 10) + 1  // Placeholder scoring
        });

    } catch (error) {
        console.error('Answer Evaluation Error:', error);
        res.status(500).json({ 
            error: 'Answer evaluation failed',
            details: error.message 
        });
    }
};

exports.submitFullInterview = async (req, res) => {
    try {
        const { resumeId, answers } = req.body;

        // Find the corresponding resume
        const resume = await Resume.findById(resumeId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Use Gemini for comprehensive evaluation
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        // Construct a detailed evaluation prompt
        const evaluationPrompt = `
            Evaluate the candidate's interview performance based on these answers:
            
            Interview Questions and Answers:
            ${resume.interviewQuestions.map((question, index) => 
                `Question ${index + 1}: ${question}\nAnswer: ${answers[index]}`
            ).join('\n\n')}

            Evaluation Criteria:
            1. Clarity and Coherence of Responses
            2. Depth of Understanding
            3. Relevance to Questions
            4. Communication Skills
            5. Problem-Solving Approach

            Provide:
            - Detailed Feedback
            - Overall Performance Score (out of 100)
            - Strengths
            - Areas of Improvement
        `;

        const result = await model.generateContent(evaluationPrompt);
        const fullEvaluation = result.response.text();

        // Extract score (you might need to parse this carefully)
        const scoreMatch = fullEvaluation.match(/Overall Performance Score:\s*(\d+)/i);
        const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

        // Save interview performance if needed
        const interviewPerformance = new InterviewPerformance({
            resumeId,
            answers,
            fullEvaluation,
            overallScore
        });
        await interviewPerformance.save();

        res.json({
            fullEvaluation,
            overallScore
        });

    } catch (error) {
        console.error('Full Interview Submission Error:', error);
        res.status(500).json({ 
            error: 'Interview submission failed',
            details: error.message 
        });
    }
};