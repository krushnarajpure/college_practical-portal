import { randomUUID } from 'crypto';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Document, Packer, Paragraph } from 'docx';
import ExcelJS from 'exceljs';
import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { getAcademicDocumentBucket } from '../config/storage.js';

const aiModel = 'gemini-3.8-flash';

function unsupported(message) {
  return Object.assign(new Error(message), { statusCode: 422, name: 'DocumentProcessingUnsupported' });
}

export async function readGridFsFile(fileId) {
  const chunks = [];
  const stream = getAcademicDocumentBucket().openDownloadStream(fileId);
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function getFieldInfo(field) {
  const type = field.constructor.name;
  let value = '';
  let options = [];
  try {
    if (type === 'PDFTextField') value = field.getText() || '';
    else if (type === 'PDFCheckBox') value = field.isChecked() ? 'true' : 'false';
    else if (type === 'PDFDropdown' || type === 'PDFOptionList' || type === 'PDFRadioGroup') {
      value = field.getSelected()?.join(', ') || '';
      options = field.getOptions?.() || [];
    }
  } catch {
    value = '';
  }
  return { name: field.getName(), type, value, options };
}

export async function getEditablePdfFields(buffer) {
  let pdf;
  try {
    pdf = await PDFDocument.load(buffer);
  } catch {
    throw unsupported('This PDF cannot be opened for safe form editing. The original file is unchanged.');
  }
  let fields;
  try {
    fields = pdf.getForm().getFields().map(getFieldInfo);
  } catch {
    throw unsupported('This PDF has no supported fillable form fields. Its visual layout cannot be edited safely.');
  }
  if (!fields.length) throw unsupported('This PDF has no fillable form fields. Its visual layout cannot be edited safely.');
  return { pdf, fields };
}

export async function fillPdfForm(buffer, requestedValues) {
  const { pdf, fields } = await getEditablePdfFields(buffer);
  const form = pdf.getForm();
  let changed = 0;
  for (const fieldInfo of fields) {
    const value = requestedValues[fieldInfo.name];
    if (value === undefined || value === null) continue;
    const field = form.getField(fieldInfo.name);
    const nextValue = String(value);
    if (fieldInfo.type === 'PDFTextField') field.setText(nextValue);
    else if (fieldInfo.type === 'PDFCheckBox') nextValue.toLowerCase() === 'true' ? field.check() : field.uncheck();
    else if (fieldInfo.type === 'PDFDropdown' || fieldInfo.type === 'PDFOptionList' || fieldInfo.type === 'PDFRadioGroup') field.select(nextValue);
    else continue;
    changed += 1;
  }
  if (!changed) throw unsupported('No requested values matched supported fields in this PDF. No edited file was created.');
  return { buffer: Buffer.from(await pdf.save()), fields: fields.filter((field) => requestedValues[field.name] !== undefined) };
}

export async function generateFormFieldChanges(instruction, fields) {
  if (!env.aiApiKey || env.aiApiKey === 'placeholder_ai_key') {
    throw Object.assign(new Error('AI editing requires GEMINI_API_KEY or AI_API_KEY in the backend environment.'), { statusCode: 503, name: 'GeminiNotConfigured' });
  }
  const supportedFields = fields.filter((field) => ['PDFTextField', 'PDFCheckBox', 'PDFDropdown', 'PDFOptionList', 'PDFRadioGroup'].includes(field.type));
  if (!supportedFields.length) throw unsupported('This PDF has no supported fillable fields. AI cannot safely change its visual content.');
  const schema = {
    type: 'object',
    properties: { fields: { type: 'object', additionalProperties: { type: 'string' } } },
    required: ['fields'],
    additionalProperties: false
  };
  const client = new GoogleGenAI({ apiKey: env.aiApiKey });
  let response;
  try {
    response = await client.interactions.create({
      model: aiModel,
      input: `Return values only for fillable PDF field names directly changed by the request. Do not infer or alter other values. Keep every unrequested field unchanged. Request: ${instruction}\nAvailable fields: ${JSON.stringify(supportedFields)}`,
      response_format: { type: 'text', mime_type: 'application/json', schema },
      generation_config: { thinking_level: 'low' },
      store: false
    });
  } catch {
    throw Object.assign(new Error('Gemini could not process this edit request.'), { statusCode: 502, name: 'GeminiRequestFailed' });
  }
  try {
    const parsed = JSON.parse(response.output_text || '{}');
    const allowed = new Set(supportedFields.map((field) => field.name));
    const changes = Object.fromEntries(Object.entries(parsed.fields || {}).filter(([name, value]) => allowed.has(name) && typeof value === 'string'));
    if (!Object.keys(changes).length) throw new Error('No supported field changes were returned.');
    return changes;
  } catch {
    throw Object.assign(new Error('Gemini did not return valid changes for the fillable PDF fields.'), { statusCode: 502, name: 'GeminiInvalidResponse' });
  }
}

export async function convertPdf(buffer, format) {
  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  } catch {
    throw unsupported('Unable to extract text from this PDF. Scanned PDFs require OCR, which is not configured.');
  }
  const lines = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const grouped = new Map();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        if (!grouped.has(y)) grouped.set(y, []);
        grouped.get(y).push({ x: item.transform[4], width: item.width, text: item.str.trim() });
      }
      for (const y of [...grouped.keys()].sort((left, right) => right - left)) {
        const row = grouped.get(y).sort((left, right) => left.x - right.x);
        let line = '';
        let previousEnd = null;
        for (const item of row) {
          const gap = previousEnd === null ? 0 : item.x - previousEnd;
          line += `${gap > 28 ? '\t' : line ? ' ' : ''}${item.text}`;
          previousEnd = item.x + item.width;
        }
        if (line.trim()) lines.push(line.trim());
      }
      page.cleanup();
    }
  } catch {
    await pdf.destroy();
    throw unsupported('Unable to extract text from this PDF. Scanned PDFs require OCR, which is not configured.');
  }
  await pdf.destroy();
  const extractedLines = lines.map((line) => line.trim()).filter(Boolean);
  if (!extractedLines.length) throw unsupported('This PDF contains no extractable text. Scanned PDFs require OCR, which is not configured.');

  if (format === 'word') {
    const document = new Document({ sections: [{ children: extractedLines.map((line) => new Paragraph({ text: line.replaceAll('\t', '    ') })) }] });
    return { buffer: await Packer.toBuffer(document), extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extracted PDF text');
    const rows = extractedLines.map((line) => line.split('\t').map((cell) => cell.trim()).filter(Boolean));
    const isTabular = rows.some((row) => row.length > 1);
    if (isTabular) rows.forEach((row) => sheet.addRow(row));
    else {
      sheet.addRow(['Extracted text']);
      extractedLines.forEach((line) => sheet.addRow([line]));
    }
    sheet.columns.forEach((column) => { column.width = Math.min(60, Math.max(14, ...sheet.getColumn(column.number).values.slice(1).map((value) => String(value || '').length + 2))); });
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }
  throw Object.assign(new Error('Choose Word or Excel conversion.'), { statusCode: 400, name: 'UnsupportedConversionFormat' });
}

export async function saveDocumentVersion(document, { buffer, extension, mimeType, editType, instruction, userId }) {
  const fileName = `${path.parse(document.originalFile.fileName).name} (${editType === 'converted' ? 'Converted' : 'Edited'})${extension}`;
  const bucket = getAcademicDocumentBucket();
  const upload = bucket.openUploadStream(`${randomUUID()}${extension}`, {
    contentType: mimeType,
    metadata: { originalFileName: fileName, uploadedBy: userId, documentId: String(document._id), editType }
  });
  await new Promise((resolve, reject) => {
    upload.once('error', reject);
    upload.once('finish', resolve);
    upload.end(buffer);
  });
  document.versions.push({ fileId: upload.id, fileName, mimeType, fileSize: buffer.length, createdBy: userId, editType, instruction: instruction || '' });
  try {
    await document.save();
  } catch (error) {
    await bucket.delete(upload.id).catch(() => undefined);
    throw error;
  }
  return document.versions[document.versions.length - 1];
}

export async function getPdfPageCount(buffer) {
  try {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}