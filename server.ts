import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SUBCATEGORY_FALLBACKS: Record<string, string[]> = {
  math: ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Mixed Operations'],
  gk: ['Geography', 'History', 'Sports', 'Computers', 'General Facts'],
  science: ['Physics', 'Chemistry', 'Biology', 'Space'],
  current_affairs: ['India', 'World', 'Science and Technology', 'Sports'],
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/ai/generate-questions', async (req, res) => {
    try {
      const category = String(req.body?.category || 'science');
      const difficulty = String(req.body?.difficulty || 'easy');
      const subcategory = String(req.body?.subcategory || '');
      const count = Math.min(15, Math.max(3, Number(req.body?.count) || 8));
      const avoidPrompts: string[] = Array.isArray(req.body?.avoidPrompts)
        ? req.body.avoidPrompts.slice(0, 40).map((s: unknown) => String(s))
        : [];

      const validSubcategories =
        SUBCATEGORY_FALLBACKS[category] || SUBCATEGORY_FALLBACKS.science;
      const targetSubcategoryDesc =
        subcategory && subcategory !== 'ALL'
          ? `Strictly focus on the subcategory "${subcategory}".`
          : `Distribute questions across these subcategories: ${validSubcategories.join(', ')}.`;

      const categoryInstructions: Record<string, string> = {
        math:
          difficulty === 'easy'
            ? 'Beginner-friendly whole-number arithmetic (+, −, ×, ÷) with small positive integers (2 to 25), exact whole-number division, and zero negative/decimal results.'
            : difficulty === 'medium'
              ? 'Intermediate mental math (2-digit addition/subtraction, multiplication tables up to 18×12, exact division, and simple order of operations).'
              : 'Advanced mental math (multi-step arithmetic, percentages, squares/square roots, and bracketed expressions).',
        gk: 'Engaging, factually verified General Knowledge trivia covering World Geography, History, Sports, Computers, and General Facts.',
        science:
          'Accurate, verified Science questions covering Physics, Chemistry, Biology, and Space exploration.',
        current_affairs:
          'Verified major global & Indian current affairs, space missions (ISRO, NASA, ESA), sports championships, and Nobel Prizes from 2022–2025.',
      };

      const prompt = [
        `Generate ${count} unique, verified multiple-choice quiz questions for a fast-paced educational racing game called "Calculation Racer".`,
        `Category: ${category}`,
        `Difficulty: ${difficulty.toUpperCase()}`,
        `Topic rule: ${targetSubcategoryDesc}`,
        `Domain guidance: ${categoryInstructions[category] || categoryInstructions.science}`,
        `Every question must have:`,
        `- A clear, concise questionText (under 160 characters).`,
        `- Exactly 4 distinct options (strings).`,
        `- correctOption: integer index 0, 1, 2, or 3 corresponding to the single unambiguous right answer.`,
        `- explanation: 1 concise sentence explaining why that answer is right.`,
        `- subcategory: one of [${validSubcategories.join(', ')}].`,
        avoidPrompts.length > 0
          ? `Do NOT repeat or closely paraphrase any of these existing questions:\n- ${avoidPrompts.join('\n- ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert quiz master and fact-checker for an educational racing game. Return strictly valid JSON matching the requested schema, with 100% verified answers and zero duplicates.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionText: {
                  type: Type.STRING,
                  description: 'The multiple-choice question prompt.',
                },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Exactly 4 distinct answer choices.',
                },
                correctOption: {
                  type: Type.INTEGER,
                  description: '0-based index (0, 1, 2, or 3) of the correct option.',
                },
                explanation: {
                  type: Type.STRING,
                  description: 'Brief 1-sentence explanation of the correct answer.',
                },
                subcategory: {
                  type: Type.STRING,
                  description: 'Subcategory name from the allowed list.',
                },
              },
              required: [
                'questionText',
                'options',
                'correctOption',
                'explanation',
                'subcategory',
              ],
            },
          },
        },
      });

      const rawText = response.text || '[]';
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        res.status(500).json({ error: 'Invalid AI response format.' });
        return;
      }

      res.json({ questions: parsed });
    } catch (error) {
      console.error('AI Question Generation Error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate AI questions.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Calculation Racer server running on http://localhost:${PORT}`);
  });
}

startServer();
