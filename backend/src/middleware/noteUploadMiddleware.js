import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { getAcademicNoteBucket, storageConfig } from '../config/storage.js';

const noteGridFsStorage = {
  _handleFile(req, file, callback) {
    let uploadStream;
    let settled = false;

    try {
      uploadStream = getAcademicNoteBucket().openUploadStream(`${randomUUID()}.pdf`, {
        contentType: 'application/pdf',
        metadata: {
          originalFileName: file.originalname,
          originalMimeType: file.mimetype,
          uploadedBy: req.user?.id || null,
          purpose: 'academicNote'
        }
      });
    } catch (error) {
      callback(error);
      return;
    }

    const failUpload = (error) => {
      if (settled) return;
      settled = true;
      file.stream.unpipe(uploadStream);
      Promise.resolve()
        .then(() => uploadStream.abort())
        .catch(() => undefined)
        .finally(() => callback(error));
    };

    file.stream.once('error', failUpload);
    uploadStream.once('error', failUpload);
    uploadStream.once('finish', () => {
      if (settled) return;
      settled = true;
      callback(null, {
        id: uploadStream.id,
        gridFsFileId: uploadStream.id,
        filename: uploadStream.filename,
        size: uploadStream.length,
        originalFileName: file.originalname,
        mimeType: 'application/pdf'
      });
    });
    file.stream.pipe(uploadStream);
  },

  _removeFile(_req, file, callback) {
    if (!file.id) return callback(null);
    getAcademicNoteBucket().delete(file.id).then(() => callback(null), callback);
  }
};

export const notePdfUpload = multer({
  storage: noteGridFsStorage,
  limits: { fileSize: storageConfig.maxFileSize, files: 1 },
  fileFilter: (_req, file, callback) => {
    const validExtension = path.extname(file.originalname).toLowerCase() === '.pdf';
    if (validExtension && file.mimetype === 'application/pdf') {
      callback(null, true);
      return;
    }
    const error = Object.assign(new Error('Only PDF files are allowed.'), {
      statusCode: 400,
      name: 'InvalidPdfFile'
    });
    callback(error);
  }
});
