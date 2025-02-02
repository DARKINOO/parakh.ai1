// models/InterviewPerformance.js
const mongoose = require('mongoose');

const InterviewPerformanceSchema = new mongoose.Schema({
    resumeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Resume',
        required: true
    },
    answers: [String],
    fullEvaluation: String,
    overallScore: Number,
    scores: {
        technicalScore: Number,
        communicationScore: Number,
        problemSolvingScore: Number,
        culturalFitScore: Number,
        leadershipScore: Number
    },
    feedback: {
        strengths: [String],
        improvements: [String],
        detailedFeedback: {
            clarity: String,
            relevance: String,
            depth: String,
            communication: String
        }
    },
    performedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InterviewPerformance', InterviewPerformanceSchema);
