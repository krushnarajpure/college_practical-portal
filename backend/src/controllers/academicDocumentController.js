import mongoose from 'mongoose';
import AcademicDocument from '../models/AcademicDocument.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import User from '../models/User.js';
import { getAcademicDocumentBucket } from '../config/storage.js';
import {
  applyPdfEdits,
  convertPdf,
  generatePdfEditChanges,
  getEditablePdfContent,
  getPdfPageCount,
  readGridFsFile,
  saveDocumentVersion
} from '../services/academicDocumentProcessingService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const fail = (message, statusCode, name = 'AcademicDocumentError') => Object.assign(new Error(message), { statusCode, name });
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const populateFields = ['departmentId', 'yearId', 'semesterId', 'uploadedBy'];

function toDocument(document) {
  const item = document.toObject ? document.toObject() : document;
  return {
    _id: item._id,
    name: item.name,
    description: item.description,
    type: item.type,
    departmentId: item.departmentId,
    yearId: item.yearId,
    semesterId: item.semesterId,
    originalFile: item.originalFile,
    versions: item.versions,
    uploadedBy: item.uploadedBy,
    uploadedByName: item.uploadedByName,
    uploadedByRole: item.uploadedByRole,
    uploadedAt: item.uploadedAt,
    status: item.status,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    fileName: item.originalFile.fileName,
    fileType: item.originalFile.mimeType,
    fileSize: item.originalFile.fileSize,
    pageCount: item.originalFile.pageCount
  };
}

async function getAcademicStudent(userId) {
  const student = await User.findOne({ _id: userId, role: 'student', status: 'active' })
    .select('departmentId yearId semesterId');
  return student;
}

async function canStudentAccess(document, student) {
  if (!student || !document.isActive) return false;
  const idOf = (value) => String(value?._id || value);
  if (idOf(document.departmentId) !== idOf(student.departmentId)
    || idOf(document.yearId) !== idOf(student.yearId)
    || idOf(document.semesterId) !== idOf(student.semesterId)) return false;
  return document.status === 'published';
}

async function getAuthorizedDocument(req) {
  if (!validId(req.params.id)) throw fail('Invalid document id.', 400, 'InvalidAcademicDocumentId');
  const document = await AcademicDocument.findById(req.params.id).populate(populateFields);
  if (!document || !document.isActive) throw fail('Academic document not found.', 404, 'AcademicDocumentNotFound');
  if (req.user.role === 'student') {
    const student = await getAcademicStudent(req.user.id);
    if (!await canStudentAccess(document, student)) throw fail('This document is not available for your academic profile.', 404, 'AcademicDocumentNotFound');
  } else if (req.user.role === 'teacher' && String(document.uploadedBy?._id || document.uploadedBy) !== String(req.user.id)) {
    throw fail('You cannot access this academic document.', 403, 'Forbidden');
  }
  return document;
}

async function validateTarget(req, body) {
  const { departmentId, yearId, semesterId } = body;
  if (![departmentId, yearId, semesterId].every(validId)) throw fail('Select a valid department, year and semester.', 400, 'InvalidAcademicTarget');
  const [department, year, semester] = await Promise.all([
    Department.findOne({ _id: departmentId, status: 'active' }),
    Year.findOne({ _id: yearId, status: 'active' }),
    Semester.findOne({ _id: semesterId, status: 'active' })
  ]);
  if (!department || !year || !semester || String(semester.yearId) !== String(year._id)) {
    throw fail('The selected academic target is invalid.', 400, 'InvalidAcademicTarget');
  }
  const semestersByLevel = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8] };
  if (!semestersByLevel[Number(year.academicLevel)]?.includes(Number(semester.number))) {
    throw fail('The selected semester does not belong to the selected year.', 400, 'InvalidAcademicTarget');
  }
  if (req.user.role === 'teacher') {
    const teacher = await User.findById(req.user.id).select('departmentId');
    if (teacher?.departmentId && String(teacher.departmentId) !== String(department._id)) {
      throw fail('You can only publish to your assigned department.', 403, 'Forbidden');
    }
  }
}

export const listStudentDocuments = async (req, res, next) => {
  try {
    const student = await getAcademicStudent(req.user.id);
    if (!student?.departmentId || !student?.yearId || !student?.semesterId) {
      return res.status(200).json(successResponse('No academic documents match your profile.', { documents: [] }));
    }
    const candidates = await AcademicDocument.find({
      isActive: true,
      status: 'published',
      departmentId: student.departmentId,
      yearId: student.yearId,
      semesterId: student.semesterId
    }).populate(populateFields).sort({ createdAt: -1 });
    const documents = [];
    for (const document of candidates) {
      if (await canStudentAccess(document, student)) documents.push(toDocument(document));
    }
    return res.status(200).json(successResponse('Academic documents retrieved.', { documents }));
  } catch (error) {
    next(error);
  }
};

export const listTeacherDocuments = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? { isActive: true } : { uploadedBy: req.user.id, isActive: true };
    const documents = await AcademicDocument.find(filter).populate(populateFields).sort({ createdAt: -1 });
    return res.status(200).json(successResponse('Teacher documents retrieved.', { documents: documents.map(toDocument) }));
  } catch (error) {
    next(error);
  }
};

export const createAcademicDocument = async (req, res, next) => {
  try {
    if (!req.file?.id) throw fail('Choose a document to upload.', 400, 'MissingAcademicDocumentFile');
    const name = String(req.body.name || '').trim();
    const type = String(req.body.type || '').trim();
    const allowedTypes = ['Assignment', 'Certificate', 'Index', 'Practical', 'Notes', 'Other Document'];
    if (!name) throw fail('Document name is required.', 400, 'InvalidAcademicDocument');
    if (!allowedTypes.includes(type)) throw fail('Select a valid document type.', 400, 'InvalidAcademicDocumentType');
    await validateTarget(req, req.body);
    const uploader = await User.findOne({ _id: req.user.id, role: req.user.role, status: 'active' }).select('name');
    if (!uploader) throw fail('Your account is not authorized to upload documents.', 403, 'Forbidden');
    const pageCount = req.file.originalFileName.toLowerCase().endsWith('.pdf')
      ? await getPdfPageCount(await readGridFsFile(req.file.id))
      : null;
    const document = await AcademicDocument.create({
      name,
      description: req.body.description || '',
      type,
      departmentId: req.body.departmentId,
      yearId: req.body.yearId,
      semesterId: req.body.semesterId,
      originalFile: { fileId: req.file.id, fileName: req.file.originalFileName, mimeType: req.file.mimeType, fileSize: req.file.size, pageCount },
      uploadedBy: req.user.id,
      uploadedByName: uploader.name,
      uploadedByRole: req.user.role,
      uploadedAt: new Date(),
      status: 'published'
    });
    await document.populate(populateFields);
    return res.status(201).json(successResponse('Document uploaded successfully.', { document: toDocument(document) }));
  } catch (error) {
    if (req.file?.id) {
      try { await getAcademicDocumentBucket().delete(req.file.id); } catch { error.cleanupFailed = true; }
    }
    next(error);
  }
};

export const getAcademicDocument = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    return res.status(200).json(successResponse('Academic document retrieved.', { document: toDocument(document) }));
  } catch (error) {
    next(error);
  }
};

export const updateAcademicDocument = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    const fields = ['name', 'description', 'type'];
    for (const field of fields) {
      if (req.body[field] !== undefined) document[field] = String(req.body[field]).trim();
    }
    if (req.body.name !== undefined && !document.name) throw fail('Document name is required.', 400, 'InvalidAcademicDocument');
    if (req.body.type !== undefined && !document.type) throw fail('Document type is required.', 400, 'InvalidAcademicDocument');
    if (req.body.type !== undefined && !['Assignment', 'Certificate', 'Index', 'Practical', 'Notes', 'Other Document'].includes(document.type)) {
      throw fail('Select a valid document type.', 400, 'InvalidAcademicDocumentType');
    }
    if (['departmentId', 'yearId', 'semesterId'].some((field) => req.body[field] !== undefined)) {
      const targetInput = {
        departmentId: req.body.departmentId || document.departmentId._id || document.departmentId,
        yearId: req.body.yearId || document.yearId._id || document.yearId,
        semesterId: req.body.semesterId || document.semesterId._id || document.semesterId
      };
      await validateTarget(req, targetInput);
      document.departmentId = targetInput.departmentId;
      document.yearId = targetInput.yearId;
      document.semesterId = targetInput.semesterId;
    }
    await document.save();
    await document.populate(populateFields);
    return res.status(200).json(successResponse('Academic document updated.', { document: toDocument(document) }));
  } catch (error) {
    next(error);
  }
};

export const deleteAcademicDocument = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    document.isActive = false;
    await document.save();
    return res.status(200).json(successResponse('Academic document deleted.', {}));
  } catch (error) {
    next(error);
  }
};

export const getEligibleStudents = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    const filter = {
      role: 'student', status: 'active', departmentId: document.departmentId._id,
      yearId: document.yearId._id, semesterId: document.semesterId._id
    };
    const students = await User.find(filter).select('name email studentId').sort({ name: 1 });
    return res.status(200).json(successResponse('Eligible students retrieved.', { students }));
  } catch (error) {
    next(error);
  }
};

export const streamAcademicDocument = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    const version = req.params.versionId
      ? document.versions.id(req.params.versionId)
      : null;
    if (req.params.versionId && !version) throw fail('Document version not found.', 404, 'DocumentVersionNotFound');
    const file = version || document.originalFile;
    const disposition = req.query.download === 'true' || req.path.endsWith('/download') ? 'attachment' : 'inline';
    const safeName = file.fileName.replace(/[\r\n"\\]/g, '_');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.fileSize);
    res.setHeader('Content-Disposition', `${disposition}; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    const stream = getAcademicDocumentBucket().openDownloadStream(file.fileId);
    stream.on('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getEditableFields = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('Manual editing is currently available for fillable PDF forms only.', 422, 'DocumentEditingUnsupported');
    }
    const buffer = await readGridFsFile(document.originalFile.fileId);
    const content = await getEditablePdfContent(buffer);
    return res.status(200).json(successResponse('PDF edit content retrieved.', content));
  } catch (error) {
    next(error);
  }
};

export const previewManualEdit = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('Manual editing is available for PDF files only.', 415, 'DocumentEditingUnsupported');
    }
    const source = await readGridFsFile(document.originalFile.fileId);
    const preview = await applyPdfEdits(source, {
      formValues: req.body?.formValues || req.body?.values || {},
      changes: req.body?.changes || []
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.name.replace(/[\r\n"\\]/g, '_')} (Preview).pdf"`);
    res.setHeader('Content-Length', preview.buffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(preview.buffer);
  } catch (error) {
    next(error);
  }
};

export const createManualEdit = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('Manual editing is currently available for fillable PDF forms only.', 422, 'DocumentEditingUnsupported');
    }
    const formValues = req.body?.formValues || req.body?.values || {};
    const changes = req.body?.changes || [];
    const source = await readGridFsFile(document.originalFile.fileId);
    const edited = await applyPdfEdits(source, { formValues, changes });
    const version = await saveDocumentVersion(document, {
      buffer: edited.buffer,
      extension: '.pdf',
      mimeType: 'application/pdf',
      editType: 'manual',
      instruction: 'Manual PDF text edit',
      userId: req.user.id,
      changes: edited.changes
    });
    return res.status(201).json(successResponse('Document edited successfully.', { documentId: document._id, version, changes: edited.changes }));
  } catch (error) {
    next(error);
  }
};

export const getAiEditChanges = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('AI editing is available for PDF files only.', 415, 'DocumentEditingUnsupported');
    }
    const instruction = String(req.body?.instruction || '').trim();
    if (!instruction || instruction.length > 2000) throw fail('Describe the changes in 1 to 2000 characters.', 400, 'InvalidAiInstruction');
    const source = await readGridFsFile(document.originalFile.fileId);
    const content = await getEditablePdfContent(source);
    const edit = await generatePdfEditChanges(instruction, content);
    return res.status(200).json(successResponse('Gemini edit instructions generated.', edit));
  } catch (error) {
    next(error);
  }
};

export const createAiEdit = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    const instruction = String(req.body?.instruction || '').trim();
    if (!instruction || instruction.length > 2000) throw fail('Describe the changes in 1 to 2000 characters.', 400, 'InvalidAiInstruction');
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('AI visual editing is currently supported only for fillable PDF forms.', 422, 'DocumentEditingUnsupported');
    }
    const source = await readGridFsFile(document.originalFile.fileId);
    let edit = { changes: req.body?.changes, formValues: req.body?.formValues };
    if (!Array.isArray(edit.changes) || !edit.formValues || typeof edit.formValues !== 'object') {
      const content = await getEditablePdfContent(source);
      edit = await generatePdfEditChanges(instruction, content);
    }
    const edited = await applyPdfEdits(source, edit);
    const version = await saveDocumentVersion(document, {
      buffer: edited.buffer,
      extension: '.pdf',
      mimeType: 'application/pdf',
      editType: 'ai',
      instruction,
      userId: req.user.id,
      changes: edited.changes
    });
    return res.status(201).json(successResponse('Document edited successfully.', { documentId: document._id, version, changes: edited.changes }));
  } catch (error) {
    next(error);
  }
};

export const convertAcademicDocument = async (req, res, next) => {
  try {
    const document = await getAuthorizedDocument(req);
    const format = req.params.format;
    if (!['word', 'excel'].includes(format)) throw fail('Choose Word or Excel conversion.', 400, 'UnsupportedConversionFormat');
    if (document.originalFile.mimeType !== 'application/pdf' && !document.originalFile.fileName.toLowerCase().endsWith('.pdf')) {
      throw fail('Only PDF files can be converted to Word or Excel.', 415, 'UnsupportedConversionSource');
    }
    const source = await readGridFsFile(document.originalFile.fileId);
    const output = await convertPdf(source, format);
    const version = await saveDocumentVersion(document, {
      ...output,
      editType: 'converted',
      instruction: `Converted to ${format}`,
      userId: req.user.id
    });
    return res.status(201).json(successResponse('Document converted successfully.', { version, note: format === 'excel' ? 'PDF text is extracted into spreadsheet rows; layout and tables may not be exact.' : 'PDF text is reconstructed as paragraphs; exact page layout may differ.' }));
  } catch (error) {
    next(error);
  }
};

export const reportUnsupportedEdit = async (req, res, next) => {
  try {
    await getAuthorizedDocument(req);
    return res.status(422).json(errorResponse('This file does not contain editable form fields. Editing is unavailable because changing its visual layout reliably is not supported.', 'DocumentEditingUnsupported', 422));
  } catch (error) {
    next(error);
  }
};

export const listAcademicDocuments = (req, res, next) => {
  if (req.user.role === 'student') return listStudentDocuments(req, res, next);
  return listTeacherDocuments(req, res, next);
};