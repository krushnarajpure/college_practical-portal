import { env } from '../config/env.js';

const fields = ['title', 'aim', 'about', 'objectives', 'requirements', 'theory', 'procedure', 'task', 'expectedOutput', 'importantPoints', 'commonErrors', 'vivaQuestions'];

function normalizeResult(value) {
  const result = {};
  for (const field of fields) {
    if (['objectives', 'requirements', 'procedure', 'importantPoints', 'commonErrors', 'vivaQuestions'].includes(field)) {
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

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.aiApiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `Read the attached college practical PDF carefully. Draft a truthful, student-friendly practical guide in clear English. Use the practical title "${title}" as context, but prefer details in the PDF. Never invent specific requirements, commands, output, or facts that the PDF does not support; leave unsupported strings empty and unsupported lists empty. Return JSON with these exact fields: title (string), aim (string), about (string), objectives (string[]), requirements (string[]), theory (string), procedure (string[]), task (string), expectedOutput (string), importantPoints (string[]), commonErrors (string[]), vivaQuestions (string[]).` },
            { inlineData: { mimeType: 'application/pdf', data: pdfBuffer.toString('base64') } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.error?.message || 'The AI service could not analyze this PDF.';
      throw Object.assign(new Error(message), { statusCode: response.status === 429 ? 429 : 502 });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
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