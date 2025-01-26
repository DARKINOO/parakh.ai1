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
    performedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('InterviewPerformance', InterviewPerformanceSchema);