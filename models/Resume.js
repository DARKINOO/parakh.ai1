const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  fileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  cloudinaryPublicId: String,
  jobPreferences: {
    industry: String,
    position: String,
    experienceLevel: String,
    desiredLocations: [String]
  },
  interviewQuestions: [String],
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resume', ResumeSchema);