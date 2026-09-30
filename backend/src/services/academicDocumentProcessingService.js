import { randomUUID } from 'crypto';
import path from 'path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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

export async function extractPdfTextItems(buffer, limit = 500) {
  let pdf;
  try {
    pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  } catch {
    throw unsupported('Unable to read this PDF. The original file is unchanged.');
  }

  const items = [];
  let totalTextItems = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      let itemIndex = 0;
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const transform = item.transform || [];
        const fontSize = Math.max(4, Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0, Number(transform[2]) || 0, Number(transform[3]) || 0) / Math.SQRT2);
        totalTextItems += 1;
        if (items.length < limit) {
          items.push({
            id: `p${pageNumber}-t${itemIndex}`,
            pageNumber,
            text: item.str,
            x: Number(transform[4]) || 0,
            y: Number(transform[5]) || 0,
            width: Math.max(0, Number(item.width) || 0),
            height: Math.max(1, Number(item.height) || fontSize),
            fontSize,
            fontName: item.fontName || '',
            pageWidth: viewport.width,
            pageHeight: viewport.height
          });
        }
        itemIndex += 1;
      }
      page.cleanup();
    }
  } catch {
    await pdf.destroy();
    throw unsupported('Unable to extract text positions from this PDF. The original file is unchanged.');
  }
  await pdf.destroy();
  return { items, totalTextItems, pageCount: pdf.numPages };
}

export async function getEditablePdfContent(buffer) {
  let pdf;
  try {
    pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    throw unsupported('This PDF cannot be opened. The original file is unchanged.');
  }
  let fields = [];
  try {
    fields = pdf.getForm().getFields().map(getFieldInfo);
  } catch {
    fields = [];
  }
  const { items, totalTextItems, pageCount } = await extractPdfTextItems(buffer);
  return { fields, textItems: items, totalTextItems, pageCount };
}

function closestFont(fontName) {
  const name = String(fontName || '').toLowerCase();
  const bold = name.includes('bold') || name.includes('black') || name.includes('heavy');
  const italic = name.includes('italic') || name.includes('oblique');
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export async function applyPdfEdits(buffer, { formValues = {}, changes = [] } = {}) {
  if (!formValues || typeof formValues !== 'object' || Array.isArray(formValues) || !Array.isArray(changes)) {
    throw Object.assign(new Error('Provide valid PDF edit changes.'), { statusCode: 400, name: 'InvalidPdfChanges' });
  }
  if (changes.length > 500) throw Object.assign(new Error('A single edit can contain at most 500 text changes.'), { statusCode: 400, name: 'TooManyPdfChanges' });

  let pdf;
  try {
    pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    throw unsupported('This PDF cannot be opened for editing. The original file is unchanged.');
  }
  const extracted = await extractPdfTextItems(buffer);
  const itemsById = new Map(extracted.items.map((item) => [item.id, item]));
  const appliedChanges = [];
  const pageFonts = new Map();

  const values = Object.entries(formValues).filter(([, value]) => value !== undefined && value !== null);
  if (values.length) {
    let form;
    try {
      form = pdf.getForm();
    } catch {
      throw unsupported('This PDF has no fillable fields. Use the detected text replacements instead.');
    }
    const available = new Map(form.getFields().map((field) => [field.getName(), field]));
    for (const [name, rawValue] of values) {
      const field = available.get(name);
      if (!field) continue;
      const oldText = getFieldInfo(field).value;
      const newText = String(rawValue).slice(0, 1000);
      if (oldText === newText) continue;
      const type = field.constructor.name;
      if (type === 'PDFTextField') field.setText(newText);
      else if (type === 'PDFCheckBox') newText.toLowerCase() === 'true' ? field.check() : field.uncheck();
      else if (['PDFDropdown', 'PDFOptionList', 'PDFRadioGroup'].includes(type)) field.select(newText);
      else continue;
      appliedChanges.push({ itemId: `form:${name}`, field: name, oldText, newText, pageNumber: null, x: null, y: null });
    }
  }

  for (const requested of changes) {
    const newText = String(requested?.newText ?? '').slice(0, 1000);
    if (!newText && requested?.itemId) {
      const item = itemsById.get(requested.itemId);
      if (!item) throw Object.assign(new Error('A selected PDF text item is no longer available.'), { statusCode: 400, name: 'InvalidPdfTextItem' });
    }

    if (requested?.itemId) {
      const item = itemsById.get(requested.itemId);
      if (!item) throw Object.assign(new Error('A selected PDF text item is no longer available.'), { statusCode: 400, name: 'InvalidPdfTextItem' });
      if (requested.oldText !== undefined && String(requested.oldText) !== item.text) {
        throw Object.assign(new Error('The source PDF text changed. Reload the editor before applying changes.'), { statusCode: 409, name: 'StalePdfTextItem' });
      }
      if (newText === item.text) continue;
      const page = pdf.getPage(item.pageNumber - 1);
      const fontSize = Math.min(96, Math.max(4, item.fontSize));
      const x = Math.max(0, Math.min(item.x, page.getWidth() - 1));
      const baseline = Math.max(0, Math.min(item.y, page.getHeight() - 1));
      const padding = Math.max(0.75, fontSize * 0.06);
      const coverY = Math.max(0, baseline - Math.max(1, item.height * 0.22));
      const coverHeight = Math.min(page.getHeight() - coverY, Math.max(fontSize * 1.08, item.height * 1.08));
      const coverWidth = Math.min(page.getWidth() - x, Math.max(item.width, fontSize * 0.45) + padding * 2);
      page.drawRectangle({ x: Math.max(0, x - padding), y: coverY, width: coverWidth, height: coverHeight, color: rgb(1, 1, 1) });
      const fontKey = closestFont(item.fontName);
      if (!pageFonts.has(fontKey)) pageFonts.set(fontKey, await pdf.embedFont(fontKey));
      const font = pageFonts.get(fontKey);
      const nextItem = extracted.items
        .filter((candidate) => candidate.pageNumber === item.pageNumber && candidate.x > item.x && Math.abs(candidate.y - item.y) < Math.max(2, fontSize * 0.25))
        .sort((left, right) => left.x - right.x)[0];
      const availableWidth = nextItem ? Math.max(fontSize, nextItem.x - x - padding * 2) : Math.max(fontSize, page.getWidth() - x - padding);
      const fittedSize = Math.max(4, Math.min(fontSize, font.widthOfTextAtSize(newText, fontSize) > availableWidth
        ? fontSize * availableWidth / font.widthOfTextAtSize(newText, fontSize)
        : fontSize));
      page.drawText(newText, { x, y: baseline, size: fittedSize, font, color: rgb(0, 0, 0), maxWidth: availableWidth });
      appliedChanges.push({ itemId: item.id, field: String(requested.field || item.text).slice(0, 160), oldText: item.text, newText, pageNumber: item.pageNumber, x: item.x, y: item.y, width: item.width, height: item.height, fontSize: fittedSize });
      continue;
    }

    const pageNumber = Number(requested?.pageNumber);
    const x = Number(requested?.x);
    const y = Number(requested?.y);
    const fontSize = Math.min(96, Math.max(4, Number(requested?.fontSize) || 12));
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.getPageCount()
      || !Number.isFinite(x) || !Number.isFinite(y) || !newText) {
      throw Object.assign(new Error('Manual placement needs text, a valid page, and numeric X/Y coordinates.'), { statusCode: 400, name: 'InvalidPdfPlacement' });
    }
    const page = pdf.getPage(pageNumber - 1);
    if (x < 0 || y < 0 || x >= page.getWidth() || y >= page.getHeight()) {
      throw Object.assign(new Error('Manual text placement must be inside the PDF page.'), { statusCode: 400, name: 'InvalidPdfPlacement' });
    }
    const fontKey = closestFont(requested.fontName);
    if (!pageFonts.has(fontKey)) pageFonts.set(fontKey, await pdf.embedFont(fontKey));
    page.drawText(newText, { x, y, size: fontSize, font: pageFonts.get(fontKey), color: rgb(0, 0, 0), maxWidth: page.getWidth() - x });
    appliedChanges.push({ itemId: null, field: String(requested.field || 'Added text').slice(0, 160), oldText: '', newText, pageNumber, x, y, width: null, height: null, fontSize });
  }

  if (!appliedChanges.length) throw Object.assign(new Error('No text or form values changed. Edit a value before previewing or applying.'), { statusCode: 400, name: 'NoPdfChanges' });
  return { buffer: Buffer.from(await pdf.save()), changes: appliedChanges, pageCount: pdf.getPageCount() };
}

export async function generatePdfEditChanges(instruction, { fields = [], textItems = [] } = {}) {
  if (!env.aiApiKey || env.aiApiKey === 'placeholder_ai_key') {
    throw Object.assign(new Error('AI editing requires GEMINI_API_KEY or AI_API_KEY in the backend environment.'), { statusCode: 503, name: 'GeminiNotConfigured' });
  }
  const schema = {
    type: 'object',
    properties: {
      changes: { type: 'array', items: { type: 'object', properties: {
        itemId: { type: 'string' }, field: { type: 'string' }, oldText: { type: 'string' }, newText: { type: 'string' }
      }, required: ['itemId', 'field', 'oldText', 'newText'], additionalProperties: false } },
      formValues: { type: 'object', additionalProperties: { type: 'string' } }
    },
    required: ['changes', 'formValues'],
    additionalProperties: false
  };
  const client = new GoogleGenAI({ apiKey: env.aiApiKey });
  let response;
  try {
    response = await client.interactions.create({
      model: aiModel,
      input: `Return only structured replacements for the requested PDF text. Keep the original PDF as the base; do not recreate its design. For a static text item, return its exact itemId and oldText, and return newText as the entire replacement for that one item. Never change an item not required by the instruction. For fillable form values, use only exact field names. Request: ${instruction}\nStatic PDF text items: ${JSON.stringify(textItems.map(({ id, text, pageNumber }) => ({ itemId: id, oldText: text, pageNumber })))}\nFillable fields: ${JSON.stringify(fields.map(({ name, value, type }) => ({ name, value, type })))}`,
      response_format: { type: 'text', mime_type: 'application/json', schema },
      generation_config: { thinking_level: 'low' },
      store: false
    });
  } catch {
    throw Object.assign(new Error('Gemini could not process this edit request.'), { statusCode: 502, name: 'GeminiRequestFailed' });
  }
  try {
    const parsed = JSON.parse(response.output_text || '{}');
    const textById = new Map(textItems.map((item) => [item.id, item]));
    const fieldNames = new Set(fields.map((field) => field.name));
    const changes = (parsed.changes || []).filter((change) => {
      const item = textById.get(change.itemId);
      return item && change.oldText === item.text && typeof change.newText === 'string' && change.newText.length <= 1000;
    }).map((change) => ({ ...change, newText: change.newText }));
    const formValues = Object.fromEntries(Object.entries(parsed.formValues || {}).filter(([name, value]) => fieldNames.has(name) && typeof value === 'string' && value.length <= 1000));
    if (!changes.length && !Object.keys(formValues).length) throw new Error('No requested text replacements were returned.');
    return { changes, formValues };
  } catch {
    throw Object.assign(new Error('Gemini did not return valid, document-matched edit instructions.'), { statusCode: 502, name: 'GeminiInvalidResponse' });
  }
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

export async function saveDocumentVersion(document, { buffer, extension, mimeType, editType, instruction, userId, changes = [] }) {
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
  document.versions.push({ fileId: upload.id, fileName, mimeType, fileSize: buffer.length, createdBy: userId, editType, instruction: instruction || '', changes });
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