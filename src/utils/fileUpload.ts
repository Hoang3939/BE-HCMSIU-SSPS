import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Allowed file types based on business rules
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
];

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const dateDir = path.join(uploadsDir, String(year), month, day);
    
    if (!fs.existsSync(dateDir)) {
      fs.mkdirSync(dateDir, { recursive: true });
    }
    
    cb(null, dateDir);
  },
  filename: (req, file, cb) => {
    // Tạo tên file unique: UUID + timestamp + extension
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const storedFileName = `file_${timestamp}_${uniqueId}${ext}`;
    cb(null, storedFileName);
  },
});

// File filter để validate
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Kiểm tra MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('Định dạng file không được hỗ trợ'));
  }
  
  // Kiểm tra extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Định dạng file không được hỗ trợ'));
  }

  // Kiểm tra tên file dài tối đa 255 ký tự
  if (file.originalname.length > 255) {
    return cb(new Error('Tên file quá dài (tối đa 255 ký tự)'));
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

