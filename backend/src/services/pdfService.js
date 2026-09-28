import { ObjectId } from 'mongodb';
import PDF from '../models/PDF.js';
import Practical from '../models/Practical.js';
import { getGridFSBucket } from '../config/storage.js';

const makeError = (message, statusCode, name = 'PdfError') => Object.assign(new Error(message), { statusCode, name });

function asObjectId(value, label = 'PDF ID') {
  if (typeof value !== 'string' && !(value instanceof ObjectId)) {
    throw makeError(`Invalid ${label.toLowerCase()}.`, 400, 'InvalidId');
  }
  const text = String(value);
  if (!/^[a-f\d]{24}$/i.test(text)) throw makeError(`Invalid ${label.toLowerCase()}.`, 400, 'InvalidId');
  return new ObjectId(text);
}

async function findGridFsFile(gridFsFileId) {
  const id = asObjectId(gridFsFileId, 'GridFS file ID');
  const file = await getGridFSBucket().find({ _id: id }).limit(1).next();
  if (!file) throw makeError('GridFS PDF file not found.', 404, 'GridFsFileNotFound');
  return file;
}

export async function uploadPdf({ practical, uploadedBy, file }) {
  if (!file?.id || !practical?._id || !uploadedBy) {
    throw makeError('Upload metadata is incomplete.', 400, 'InvalidPdfUpload');
  }

  let metadata;
  try {
    metadata = await PDF.create({
      practicalId: practical._id,
      uploadedBy,
      gridFsFileId: file.id,
      gridFsFileName: file.filename,
      originalFileName: file.originalFileName,
      mimeType: file.mimeType,
      fileSize: file.size
    });

    const linkedPractical = await Practical.findOneAndUpdate(
      { _id: practical._id, pdfId: null },
      { $set: { pdfId: metadata._id } },
      { new: true }
    );

    if (!linkedPractical) throw makeError('This practical already has an original PDF.', 409, 'PdfAlreadyAttached');
    return metadata;
  } catch (error) {
    if (metadata) {
      await Practical.updateOne({ _id: practical._id, pdfId: metadata._id }, { $set: { pdfId: null } }).catch(() => undefined);
      await PDF.deleteOne({ _id: metadata._id }).catch(() => undefined);
    }
    await Promise.resolve().then(() => getGridFSBucket().delete(file.id)).catch(() => undefined);
    throw error;
  }
}

export async function getPdfById(pdfId) {
  const id = asObjectId(pdfId);
  const metadata = await PDF.findById(id);
  if (!metadata) throw makeError('PDF metadata not found.', 404, 'PdfMetadataNotFound');
  return metadata;
}

export async function streamPdf(gridFsFileId, response) {
  const id = asObjectId(gridFsFileId, 'GridFS file ID');
  await findGridFsFile(id);

  return new Promise((resolve, reject) => {
    const downloadStream = getGridFSBucket().openDownloadStream(id);
    const cleanup = () => {
      response.removeListener('close', handleResponseClose);
      response.removeListener('error', handleResponseError);
    };
    const handleResponseClose = () => {
      if (!response.writableEnded) {
        const error = makeError('PDF stream was closed by the client.', 499, 'ClientClosedRequest');
        cleanup();
        downloadStream.destroy();
        reject(error);
      }
    };
    const handleResponseError = (error) => {
      cleanup();
      downloadStream.destroy();
      reject(error);
    };

    downloadStream.once('error', (error) => {
      cleanup();
      reject(error);
    });
    downloadStream.once('end', () => {
      cleanup();
      resolve();
    });
    response.once('close', handleResponseClose);
    response.once('error', handleResponseError);
    downloadStream.pipe(response);
  });
}

export async function downloadPdf(pdf, response, disposition = 'attachment') {
  const originalFileName = String(pdf.originalFileName || 'practical.pdf').replace(/[\r\n"\\]/g, '_');
  const encodedFileName = encodeURIComponent(pdf.originalFileName || 'practical.pdf').replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  response.setHeader('Content-Type', 'application/pdf');
  response.setHeader('Content-Length', pdf.fileSize);
  response.setHeader('Content-Disposition', `${disposition}; filename="${originalFileName}"; filename*=UTF-8''${encodedFileName}`);
  return streamPdf(pdf.gridFsFileId, response);
}

export async function deletePdf(pdfId) {
  const metadata = await getPdfById(pdfId);
  const bucket = getGridFSBucket();
  await findGridFsFile(metadata.gridFsFileId);
  await bucket.delete(asObjectId(metadata.gridFsFileId, 'GridFS file ID'));
  await Practical.updateOne({ _id: metadata.practicalId, pdfId: metadata._id }, { $set: { pdfId: null } });
  await PDF.deleteOne({ _id: metadata._id });
  return metadata;
}

const pdfService = { uploadPdf, getPdfById, streamPdf, downloadPdf, deletePdf };
export default pdfService;
