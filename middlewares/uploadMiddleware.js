const multer = require('multer');
const path = require('path');
const fs = require('fs');
const tempDir = path.join(__dirname, '..', 'temp');
fs.chmodSync(tempDir, 0o777);

// Configure multer for temporary storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null,  path.join(__dirname, '..', 'temp')) // Temporary storage before uploading to Cloudinary
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`)
    }
});

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Multer upload configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'), false);
        }
    }
});

module.exports = upload;