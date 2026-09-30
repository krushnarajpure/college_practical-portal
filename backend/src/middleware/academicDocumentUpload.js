import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { getAcademicDocumentBucket } from '../config/storage.js';
import { env } from '../config/env.js';

const mimeTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const maxFileSize = env.maxAcademicDocumentSizeBytes;

const gridFsStorage = {
  _handleFile(req, file, callback) {
    let stream;
    let mimeType;
    let settled = false;
    try {
      const extension = path.extname(file.originalname).toLowerCase();
      mimeType = mimeTypes[extension];
      stream = getAcademicDocumentBucket().openUploadStream(`${randomUUID()}${extension}`, {
        contentType: mimeType,
        metadata: { originalFileName: file.originalname, uploadedBy: req.user?.id || null }
      });
    } catch (error) {
      callback(error);
      return;
    }

    const fail = (error) => {
      if (settled) return;
      settled = true;
      file.stream.unpipe(stream);
      Promise.resolve(stream.abort()).catch(() => undefined).finally(() => callback(error));
    };
    file.stream.once('error', fail);
    stream.once('error', fail);
    stream.once('finish', () => {
      if (settled) return;
      settled = true;
      callback(null, { id: stream.id, filename: stream.filename, size: stream.length, originalFileName: file.originalname, mimeType });
    });
    file.stream.pipe(stream);
  },
  _removeFile(_req, file, callback) {
    if (!file.id) return callback(null);
    getAcademicDocumentBucket().delete(file.id).then(() => callback(null), callback);
  }
};

export const academicDocumentUpload = multer({
  storage: gridFsStorage,
  limits: { fileSize: maxFileSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (mimeTypes[extension]) return callback(null, true);
    const error = Object.assign(new Error('Use a PDF, DOC, DOCX, XLS or XLSX file.'), { statusCode: 400, name: 'InvalidAcademicDocument' });
    callback(error);
  }
});