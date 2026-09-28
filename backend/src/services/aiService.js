import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

const gemini = new GoogleGenAI({ apiKey: env.aiApiKey });
const model = 'gemini-3.8-flash';
const fields = ['title', 'aim', 'about', 'objectives', 'requirements', 'theory', 'procedure', 'task', 'expectedOutput', 'importantPoints', 'commonErrors', 'vivaQuestions'];
const listFields = ['objectives', 'requirements', 'procedure', 'importantPoints', 'commonErrors', 'vivaQuestions'];
const practicalSchema = {
  type: 'object',
  properties: Object.fromEntries(fields.map((field) => [
    field,
    listFields.includes(field)
      ? { type: 'array', items: { type: 'string' } }
      : { type: 'string' }
  ])),
  required: fields,
  additionalProperties: false
};

function normalizeResult(value) {
  const result = {};
  for (const field of fields) {
    if (listFields.includes(field)) {
      result[field] = Array.isArray(value[field]) ? value[field].map((entry) => String(entry).trim()).filter(Boolean) : [];
    } else {
      result[field] = typeof value[field] === 'string' ? value[field].trim() : '';
    }
  }
  if (!result.title || !result.aim || !result.procedure.length) {
    throw Object.assign(new Error('AI returned incomplete practical guidance. Please review the PDF and try again.'), { statusCode: 502 });
  }
  return result;
}

const aiService = {
  generateStructuredPractical: async ({ pdfBuffer, title }) => {
    if (!env.aiApiKey || env.aiApiKey === 'placeholder_ai_key') {
      throw Object.assign(new Error('PDF analysis requires a valid AI_API_KEY in the backend environment.'), { statusCode: 503 });
    }
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw Object.assign(new Error('The uploaded PDF could not be read.'), { statusCode: 400 });
    }

    let interaction;
    try {
      interaction = await gemini.interactions.create({
        model,
        input: [
          { type: 'document', mime_type: 'application/pdf', data: pdfBuffer.toString('base64') },
          { type: 'text', text: `Read the attached college practical PDF carefully. Draft a truthful, student-friendly practical guide in clear English. Use the practical title "${title}" as context, but prefer details in the PDF. Never invent specific requirements, commands, output, or facts that the PDF does not support; leave unsupported strings empty and unsupported lists empty. Return a practical guide matching the required JSON fields.` }
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: practicalSchema
        },
        generation_config: { thinking_level: 'low' },
        store: false
      });
    } catch (error) {
      const status = Number(error?.status ?? error?.statusCode ?? error?.code);
      throw Object.assign(new Error('The AI service could not analyze this PDF.'), { statusCode: status === 429 ? 429 : 502 });
    }

    const text = interaction.output_text?.trim();
    if (!text) throw Object.assign(new Error('The AI service returned no practical guidance.'), { statusCode: 502 });
    try {
      return normalizeResult(JSON.parse(text));
    } catch (error) {
      if (error.statusCode) throw error;
      throw Object.assign(new Error('The AI service returned invalid structured guidance. Please retry.'), { statusCode: 502 });
    }
  }
};

export default aiService;