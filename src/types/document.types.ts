/**
 * Document Types
 * Định nghĩa các types cho module Documents
 */

export interface Document {
  DocID: string;
  FileName: string;
  FileType: string;
  FileSize: number;
  FilePath: string;
  StudentID: string;
  UploadedAt?: Date;
  detectedPageCount?: number;
}

export interface UploadDocumentRequest {
  file: Express.Multer.File;
  studentId: string;
}

export interface UploadDocumentResponse {
  id: string;
  originalFileName: string;
  detectedPageCount: number;
  fileSize: number;
  uploadedAt: string;
}

export interface GetDocumentResponse extends Document {
  detectedPageCount: number;
}

export interface DocumentPreviewOptions {
  documentId: string;
  studentId: string;
}

