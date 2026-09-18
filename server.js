const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');
const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  return file.buffer.toString('utf-8');
}
app.post('/analyze', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files' });
    const parts = [];
    for (const file of req.files) {
      const text = await extractText(file);
      parts.push('=== ' + file.originalname + ' ===\n' + text);
    }
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Analyze documents and return JSON: { "project": "Name", "useCases": [{ "id": "uc1", "name": "UC name", "description": "Flow", "tasks": [{ "id": "t1", "title": "Task", "type": "business or design or tech", "description": "Details", "source": "filename" }] }] }. business=analytics, design=UI/UX, tech=backend/API/DB.' },
        { role: 'user', content: parts.join('\n\n') }
      ],
      response_format: { type: 'json_object' }
    });
    res.json(JSON.parse(response.choices[0].message.content));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/', (req, res) => res.json({ status: 'ok' }));
app.listen(process.env.PORT || 3000);
