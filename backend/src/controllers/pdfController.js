import { ObjectId } from 'mongodb';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import User from '../models/User.js';
import Practical from '../models/Practical.js';
import Subject from '../models/Subject.js';
import { getGridFSBucket } from '../config/storage.js';
import pdfService from '../services/pdfService.js';
import notificationService from '../services/notificationService.js';
import { successResponse } from '../utils/apiResponse.js';

const makeError = (message, statusCode, name = 'PdfRequestError') => Object.assign(new Error(message), { statusCode, name });
const isValidId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value) && ObjectId.isValid(value);

async function getActiveUser(tokenUser) {
  if (!isValidId(tokenUser?.id)) throw makeError('Authentication required.', 401, 'Unauthorized');
  const user = await User.findById(tokenUser.id).select('name role status departmentId yearId semesterId assignedSubjects');
  if (!user || user.status !== 'active') throw makeError('Account is unavailable.', 403, 'Forbidden');
  return user;
}

function teacherCanManage(user, practical) {
  if (user.role === 'admin') return true;
  const ownsPractical = practical.createdBy && String(practical.createdBy) === String(user._id);
  const assignedToSubject = (user.assignedSubjects || []).some((subjectId) => String(subjectId) === String(practical.subjectId));
  return user.role === 'teacher' && (ownsPractical || assignedToSubject);
}

async function getAuthorizedPdf(req) {
  const [pdf, user] = await Promise.all([
    pdfService.getPdfById(req.params.id),
    getActiveUser(req.user)
  ]);
  const practical = await Practical.findById(pdf.practicalId);
  if (!practical) throw makeError('Practical for this PDF was not found.', 404, 'PracticalNotFound');

  if (user.role === 'admin' || (user.role === 'teacher' && teacherCanManage(user, practical))) {
    return { pdf, practical, user };
  }

  if (user.role === 'student') {
    const matchesAcademicAssignment =
      user.departmentId && user.yearId && user.semesterId &&
      String(user.departmentId) === String(practical.departmentId) &&
      String(user.yearId) === String(practical.yearId) &&
      String(user.semesterId) === String(practical.semesterId);

    if (practical.status === 'published' && matchesAcademicAssignment) return { pdf, practical, user };
    throw makeError('This PDF is not available to your academic account.', 403, 'Forbidden');
  }

  throw makeError('Access denied for this PDF.', 403, 'Forbidden');
}

export const preparePdfUpload = async (req, _res, next) => {
  try {
    if (!isValidId(req.body?.practicalId)) throw makeError('A valid practicalId is required.', 400, 'InvalidPracticalId');

    const user = await getActiveUser(req.user);
    if (!['teacher', 'admin'].includes(user.role)) throw makeError('Only teachers and admins can upload PDFs.', 403, 'Forbidden');

    const practical = await Practical.findById(req.body.practicalId);
    if (!practical) throw makeError('Practical not found.', 404, 'PracticalNotFound');
    if (!teacherCanManage(user, practical)) throw makeError('You cannot manage this practical.', 403, 'Forbidden');
    if (practical.pdfId) throw makeError('This practical already has an original PDF. Delete it before uploading a replacement.', 409, 'PdfAlreadyAttached');

    req.pdfUploadContext = { practical, user };
    next();
  } catch (error) {
    if (req.file?.id) {
      try {
        await getGridFSBucket().delete(req.file.id);
      } catch {
        error.cleanupFailed = true;
      }
    }
    next(error);
  }
};

export const uploadPdf = async (req, res, next) => {
  if (!req.file) return next(makeError('A PDF file is required.', 400, 'MissingPdfFile'));

  try {
    if (!req.pdfUploadContext) throw makeError('Practical upload authorization is missing.', 403, 'Forbidden');
    const pdf = await pdfService.uploadPdf({
      practical: req.pdfUploadContext.practical,
      uploadedBy: req.pdfUploadContext.user._id,
      file: req.file
    });
    if (req.pdfUploadContext.user.role === 'teacher') {
      const subject = await Subject.findById(req.pdfUploadContext.practical.subjectId).select('name');
      await notificationService.createAdminActivity({
        actorId: req.pdfUploadContext.user._id,
        action: 'practical_pdf_uploaded',
        entityType: 'practical',
        entityId: req.pdfUploadContext.practical._id,
        practicalId: req.pdfUploadContext.practical._id,
        message: `${req.pdfUploadContext.user.name} uploaded the original PDF for "${req.pdfUploadContext.practical.title}" (${subject?.name || 'Subject'}).`
      });
    }

    return res.status(201).json(successResponse('Original PDF uploaded successfully.', {
      pdfId: pdf._id,
      fileName: pdf.originalFileName,
      fileSize: pdf.fileSize
    }));
  } catch (error) {
    return next(error);
  }
};

export const getPdfById = async (req, res, next) => {
  try {
    const { pdf } = await getAuthorizedPdf(req);
    return res.status(200).json(successResponse('PDF metadata retrieved.', {
      pdfId: pdf._id,
      practicalId: pdf.practicalId,
      fileName: pdf.originalFileName,
      mimeType: pdf.mimeType,
      fileSize: pdf.fileSize,
      uploadedAt: pdf.uploadedAt
    }));
  } catch (error) {
    return next(error);
  }
};

export const getStudentPdfText = async (req, res, next) => {
  let parsedPdf;
  try {
    const { pdf } = await getAuthorizedPdf(req);
    const chunks = [];
    const stream = getGridFSBucket().openDownloadStream(pdf.gridFsFileId);
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));

    try {
      parsedPdf = await getDocument({ data: new Uint8Array(Buffer.concat(chunks)), useSystemFonts: true }).promise;
    } catch {
      throw makeError('This practical PDF could not be read. It may be encrypted or damaged.', 422, 'PdfTextUnavailable');
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= parsedPdf.numPages; pageNumber += 1) {
      const page = await parsedPdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item) => 'str' in item && item.str.trim())
        .map((item) => item.str.trim())
        .join(' ');
      if (pageText) pages.push(pageText);
      page.cleanup();
    }

    const text = pages.join('\n\n');
    if (!text.trim()) throw makeError('This practical PDF has no selectable text. Scanned PDFs require OCR.', 422, 'PdfTextUnavailable');
    return res.status(200).json(successResponse('Practical PDF text extracted.', {
      pdfId: String(pdf._id),
      fileName: pdf.originalFileName,
      pageCount: parsedPdf.numPages,
      text: text.slice(0, 30000),
      truncated: text.length > 30000
    }));
  } catch (error) {
    return next(error);
  } finally {
    if (parsedPdf) {
      try { await parsedPdf.destroy(); } catch { /* PDF cleanup is best-effort. */ }
    }
  }
};

export const viewPdf = async (req, res, next) => {
  try {
    const { pdf } = await getAuthorizedPdf(req);
    await pdfService.downloadPdf(pdf, res, 'inline');
  } catch (error) {
    next(error);
  }
};

export const downloadPdf = async (req, res, next) => {
  try {
    const { pdf } = await getAuthorizedPdf(req);
    await pdfService.downloadPdf(pdf, res, 'attachment');
  } catch (error) {
    next(error);
  }
};

export const deletePdf = async (req, res, next) => {
  try {
    const { pdf, practical, user } = await getAuthorizedPdf(req);
    if (!teacherCanManage(user, practical)) throw makeError('Only the practical owner or an admin can delete this PDF.', 403, 'Forbidden');

    await pdfService.deletePdf(pdf._id);
    if (user.role === 'teacher') {
      const subject = await Subject.findById(practical.subjectId).select('name');
      await notificationService.createAdminActivity({
        actorId: user._id,
        action: 'practical_pdf_deleted',
        entityType: 'practical',
        entityId: practical._id,
        practicalId: practical._id,
        message: `${user.name} removed the original PDF from "${practical.title}" (${subject?.name || 'Subject'}).`
      });
    }
    return res.status(200).json(successResponse('PDF and GridFS file deleted.', { pdfId: pdf._id }));
  } catch (error) {
    return next(error);
  }
};