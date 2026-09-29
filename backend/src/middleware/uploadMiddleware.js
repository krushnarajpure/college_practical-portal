import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { getGridFSBucket, getProfilePhotoBucket, storageConfig } from '../config/storage.js';

const gridFsStorage = {
  _handleFile(req, file, callback) {
    let uploadStream;
    let settled = false;

    try {
      const extension = path.extname(file.originalname).toLowerCase();
      uploadStream = getGridFSBucket().openUploadStream(`${randomUUID()}${extension}`, {
        contentType: 'application/pdf',
        metadata: {
          originalFileName: file.originalname,
          originalMimeType: file.mimetype,
          originalEncoding: file.encoding,
          uploadedBy: req.user?.id || null
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
        mimeType: file.mimetype
      });
    });

    file.stream.pipe(uploadStream);
  },

  _removeFile(_req, file, callback) {
    if (!file.id) {
      callback(null);
      return;
    }

    Promise.resolve()
      .then(() => getGridFSBucket().delete(file.id))
      .then(() => callback(null), callback);
  }
};

export const upload = multer({
  storage: gridFsStorage,
  limits: {
    fileSize: storageConfig.maxFileSize,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const hasPdfExtension = storageConfig.supportedExtensions.includes(path.extname(file.originalname).toLowerCase());
    const hasPdfMimeType = storageConfig.allowedMimeTypes.includes(file.mimetype);
    if (hasPdfMimeType && hasPdfExtension) {
      cb(null, true);
      return;
    }

    const error = new Error('Only .pdf files with MIME type application/pdf are allowed.');
    error.statusCode = 400;
    error.name = 'InvalidPdfFile';
    cb(error);
  }
});

const profilePhotoGridFsStorage = {
  _handleFile(req, file, callback) {
    let uploadStream;
    let settled = false;

    try {
      const extension = path.extname(file.originalname).toLowerCase();
      uploadStream = getProfilePhotoBucket().openUploadStream(`${randomUUID()}${extension}`, {
        contentType: file.mimetype,
        metadata: {
          originalFileName: file.originalname,
          originalMimeType: file.mimetype,
          originalEncoding: file.encoding,
          uploadedBy: req.user?.id || null,
          purpose: 'profilePhoto'
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
        mimeType: file.mimetype
      });
    });

    file.stream.pipe(uploadStream);
  },

  _removeFile(_req, file, callback) {
    if (!file.id) {
      callback(null);
      return;
    }

    Promise.resolve()
      .then(() => getProfilePhotoBucket().delete(file.id))
      .then(() => callback(null), callback);
  }
};

export const profilePhotoUpload = multer({
  storage: profilePhotoGridFsStorage,
  limits: {
    fileSize: storageConfig.profilePhotoMaxFileSize,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const hasImageExtension = storageConfig.profilePhotoSupportedExtensions.includes(path.extname(file.originalname).toLowerCase());
    const hasImageMimeType = storageConfig.profilePhotoAllowedMimeTypes.includes(file.mimetype);
    if (hasImageMimeType && hasImageExtension) {
      cb(null, true);
      return;
    }

    const error = new Error('Only JPG, JPEG, PNG and WEBP image files are allowed.');
    error.statusCode = 400;
    error.name = 'InvalidProfilePhoto';
    cb(error);
  }
});
