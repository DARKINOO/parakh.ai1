const multer = require('multer');
const PDFParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cloudinary = require('../config/cloudinaryConfig');
const fs = require('fs');
const path = require('path');
const Resume = require('../models/Resume');
const InterviewPerformance = require('../models/InterviewPerfomance');
const upload = require('../middlewares/uploadMiddleware');
require('dotenv').config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

const extractStrengths = (text) => {
    const strengthsMatch = text.match(/Key Strengths:[\s\S]*?(?=Areas for Improvement:|$)/i);
    if (!strengthsMatch) {
        // Fallback pattern for different formatting
        const bulletPoints = text.match(/(?:^|\n)-\s*([^\n]+)/g);
        if (bulletPoints) {
            return bulletPoints
                .map(point => point.replace(/^-\s*/, '').trim())
                .filter(point => point.length > 0)
                .slice(0, 3); // Take first 3 bullet points as strengths
        }
        return [];
    }
    
    return strengthsMatch[0]
        .replace(/Key Strengths:/i, '')
        .split('\n')
        .map(s => s.replace(/^-?\s*/, '').trim())
        .filter(s => s.length > 0);
};

const extractImprovements = (text) => {
    const improvementsMatch = text.match(/Areas for Improvement:[\s\S]*?(?=Detailed Feedback:|$)/i);
    if (!improvementsMatch) {
        // Fallback pattern
        const allBulletPoints = text.match(/(?:^|\n)-\s*([^\n]+)/g) || [];
        return allBulletPoints
            .map(point => point.replace(/^-\s*/, '').trim())
            .filter(point => point.length > 0 && point.toLowerCase().includes('improve'))
            .slice(0, 3);
    }
    
    return improvementsMatch[0]
        .replace(/Areas for Improvement:/i, '')
        .split('\n')
        .map(s => s.replace(/^-?\s*/, '').trim())
        .filter(s => s.length > 0);
};

const extractScoreFromText = (text) => {
    const scorePatterns = [
        /Overall Performance Score:\s*(\d+)\/100/i,
        /Overall Performance Score:\s*(\d+)/i,
        /Overall Score:\s*(\d+)/i
    ];

    for (const pattern of scorePatterns) {
        const match = text.match(pattern);
        if (match) {
            const score = parseInt(match[1]);
            return score >= 0 && score <= 100 ? score : 75;
        }
    }
    return 75; // Default score
};

const extractDetailedFeedback = (text) => {
    const sections = {
        technical: text.match(/Technical Skills Assessment:([\s\S]*?)(?=\n\n|$)/i),
        communication: text.match(/Communication Skills:([\s\S]*?)(?=\n\n|$)/i),
        problemSolving: text.match(/Problem-Solving Approach:([\s\S]*?)(?=\n\n|$)/i),
        overall: text.match(/Detailed Feedback:([\s\S]*?)(?=\n\n|$)/i)
    };

    return {
        technical: sections.technical ? sections.technical[1].trim() : '',
        communication: sections.communication ? sections.communication[1].trim() : '',
        problemSolving: sections.problemSolving ? sections.problemSolving[1].trim() : '',
        overall: sections.overall ? sections.overall[1].trim() : ''
    };
};

const calculateScore = (text, category) => {
    const categoryText = text.toLowerCase();
    const weights = {
        excellent: 90,
        strong: 85,
        good: 80,
        solid: 75,
        adequate: 70,
        average: 65,
        fair: 60,
        poor: 50
    };

    for (const [term, score] of Object.entries(weights)) {
        if (categoryText.includes(term)) {
            return score;
        }
    }
    return 70; // Default score if no matching terms found
};

exports.submitResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = req.file;
        const jobPreferences = JSON.parse(req.body.jobPreferences || '{}');

         // Upload to Cloudinary
         const cloudinaryResponse = await cloudinary.uploader.upload(file.path, {
            folder: 'resumes',
            resource_type: 'raw',
            public_id: `resume_${Date.now()}`,
        });

        // PDF Text Extraction
        let pdfText = '';
        try {
            const pdfBuffer = fs.readFileSync(file.path);
            const pdfParseResult = await PDFParse(pdfBuffer);
            pdfText = pdfParseResult.text;

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
            filePath: cloudinaryResponse.secure_url,
            cloudinaryPublicId: cloudinaryResponse.public_id,
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
            fileUrl: cloudinaryResponse.secure_url,
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

// exports.evaluateAnswer = async (req, res) => {
//     try {
//         const { resumeId, questionIndex, answer } = req.body;

//         const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
//         const evaluationPrompt = `
//             Evaluate the candidate's interview answer precisely:
//             Candidate's Answer: ${answer}

//             Evaluation Criteria:
//             1. Clarity of Response
//             2. Relevance to Question
//             3. Depth of Insight
//             4. Communication Skills

//             Provide:
//             - Detailed Score (0-10)
//             - Specific, Constructive Feedback
//             - Key Strengths
//             - Areas for Improvement
//         `;

//         const result = await model.generateContent(evaluationPrompt);
//         const evaluation = result.response.text();

//         res.json({ 
//             evaluation,
//             score: Math.floor(Math.random() * 10) + 1  // Placeholder scoring
//         });

//     } catch (error) {
//         console.error('Answer Evaluation Error:', error);
//         res.status(500).json({ 
//             error: 'Answer evaluation failed',
//             details: error.message 
//         });
//     }
// };



exports.submitFullInterview = async (req, res) => {
    try {
        const { resumeId, answers } = req.body;
        
        const resume = await Resume.findById(resumeId);
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const evaluationPrompt = `
            Provide a detailed evaluation of the candidate's interview performance:
            
            ${resume.interviewQuestions.map((question, index) => 
                `Question ${index + 1}: ${question}\nAnswer: ${answers[index]}`
            ).join('\n\n')}

            Please structure your response exactly as follows:

            Overall Performance Score: [Score]/100

            Technical Skills Assessment:
            [Detailed analysis of technical capabilities]

            Communication Skills:
            [Analysis of communication effectiveness]

            Problem-Solving Approach:
            [Evaluation of problem-solving methodology]

            Key Strengths:
            - [Strength 1]
            - [Strength 2]
            - [Strength 3]

            Areas for Improvement:
            - [Improvement 1]
            - [Improvement 2]
            - [Improvement 3]

            Detailed Feedback:
            [Comprehensive evaluation of all aspects]
        `;

        const result = await model.generateContent(evaluationPrompt);
        const fullEvaluation = result.response.text();

        // Extract all components
        const strengths = extractStrengths(fullEvaluation);
        const improvements = extractImprovements(fullEvaluation);
        const overallScore = extractScoreFromText(fullEvaluation);
        const detailedFeedback = extractDetailedFeedback(fullEvaluation);

        // Calculate individual scores
        const technicalScore = calculateScore(detailedFeedback.technical, 'technical');
        const communicationScore = calculateScore(detailedFeedback.communication, 'communication');
        const problemSolvingScore = calculateScore(detailedFeedback.problemSolving, 'problemSolving');

        // Prepare response data
        const responseData = {
            fullEvaluation,
            overallScore,
            technicalScore,
            communicationScore,
            problemSolvingScore,
            culturalFitScore: Math.round((technicalScore + communicationScore) / 2),
            leadershipScore: Math.round((communicationScore + problemSolvingScore) / 2),
            strengths,
            improvements,
            detailedFeedback
        };

        // Save to database
        const interviewPerformance = new InterviewPerformance({
            resumeId,
            answers,
            fullEvaluation,
            overallScore: responseData.overallScore,
            scores: {
                technicalScore: responseData.technicalScore,
                communicationScore: responseData.communicationScore,
                problemSolvingScore: responseData.problemSolvingScore,
                culturalFitScore: responseData.culturalFitScore,
                leadershipScore: responseData.leadershipScore
            },
            feedback: {
                strengths,
                improvements,
                detailedFeedback
            }
        });

        await interviewPerformance.save();

        // Log the response data for debugging
        console.log('Sending response data:', responseData);

        res.json(responseData);

    } catch (error) {
        console.error('Full Interview Submission Error:', error);
        res.status(500).json({ 
            error: 'Interview submission failed',
            details: error.message 
        });
    }
};

exports.deleteResume = async (resumeId) => {
    try {
        const resume = await Resume.findById(resumeId);
        if (resume && resume.cloudinaryPublicId) {
            await cloudinary.uploader.destroy(resume.cloudinaryPublicId);
            await Resume.findByIdAndDelete(resumeId);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Delete Resume Error:', error);
        return false;
    }
};