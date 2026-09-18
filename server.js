const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
const pdfParse = require('pdf-parse');

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

async function extractText(file) {
  if (file.mimetype === 'application/pdf') {
    const data = await pdfParse(file.buffer);
    return data.text;
  }
  return file.buffer.toString('utf-8');
}

app.post('/analyze', upload.array('files'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not set on server' });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    const parts = [];
    for (const file of req.files) {
      const text = await extractText(file);
      parts.push(`=== ${file.originalname} ===\n${text}`);
    }
    const combined = parts.join('\n\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Ты — аналитик требований. Проанализируй документ(ы) и верни строго JSON без комментариев:\n{\n  "project": "Название проекта",\n  "useCases": [\n    {\n      "id": "uc1",\n      "name": "Название сценария",\n      "description": "Описание логики сценария",\n      "tasks": [\n        {\n          "id": "t1",\n          "title": "Название задачи",\n          "type": "business или design или tech",\n          "description": "Что нужно сделать",\n          "source": "Имя файла-источника"\n        }\n      ]\n    }\n  ]\n}\nКлассифицируй задачи: business = бизнес-аналитика, design = UI/UX дизайн, tech = бэкенд/API/БД.' },
        { role: 'user', content: combined }
      ],
      response_format: { type: 'json_object' }
    });
    const result = JSON.parse(response.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'UseTasker API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
