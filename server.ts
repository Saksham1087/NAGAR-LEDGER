import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

type ChatMode = 'search' | 'fast' | 'deep';
type LanguageCode = 'en' | 'mr' | 'hi';

interface ClientChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface GroundingSource {
  title: string;
  uri: string;
}

function getGenAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured on the server.');
    (err as Error & { statusCode?: number }).statusCode = 500;
    throw err;
  }

  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildCivicSystemInstruction(language: LanguageCode, contextSummary?: string): string {
  const languageDirective =
    language === 'mr'
      ? 'Respond primarily in clear, natural Marathi (मराठी) while keeping official ticket IDs (e.g. MBMC-2026-0845) and technical SLA acronyms readable.'
      : language === 'hi'
        ? 'Respond primarily in clear, natural Hindi (हिंदी) while keeping official ticket IDs (e.g. MBMC-2026-0845) and technical SLA acronyms readable.'
        : 'Respond in clear, direct English.';

  return [
    'You are the NagrikSeva Civic Copilot for Mira-Bhayandar Municipal Corporation (MBMC), Maharashtra (Wards 1–24).',
    'Your role is to assist citizens and civic observers with public works SLA accountability, ward escalation procedures, 50m duplicate clustering rules, Civic Priority Score (CPS) calculations, and live municipal/civic information.',
    'Core NagrikSeva rules you know accurately:',
    '- Statutory SLA clocks: Water Leaks & Drainage/Manholes = 12–24h; Garbage Collection = 12h; Road & Potholes = 72h; Streetlights = 48h.',
    '- Geo-Clustering: Reports within 50m of an active matching-category ticket merge via +1 Confirm instead of creating duplicates.',
    '- CPS Formula (0–100): (Base Category Urgency [18–40] + min(25, (confirmations - 1) * 3)) * (1.25 if within 200m of School/Hospital/Station/Nullah else 1.0) + floor(overdueHours / 4).',
    '- Overdue SLA Escalation: Tickets past deadline automatically escalate to the Deputy Municipal Commissioner (DMC).',
    '- Citizen Proof-of-Fix: Field engineers upload geo-matched after-photos within 25m and enter a 48-hour citizen verification audit before permanent closure.',
    '- MBMC Helplines: Central Disaster Control 022-2819-2828 (24x7), Water Supply Desk 022-2819-3021, Solid Waste Management 1800-22-4848.',
    languageDirective,
    'Keep answers practical, concise, and grounded in facts. Never invent fake live news or unverified phone numbers.',
    contextSummary ? `Current Live Ledger Context:\n${contextSummary.slice(0, 2000)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const raw = error instanceof Error ? error.message : String(error);
  console.error('[NagrikSeva Gemini API error]:', raw);
  const explicitStatus = (error as { statusCode?: number; status?: number })?.statusCode
    ?? (error as { status?: number })?.status;

  if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
    return {
      status: 400,
      message: 'Gemini API key appears invalid. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (raw.includes('PERMISSION_DENIED') || explicitStatus === 403) {
    return {
      status: 403,
      message: 'Permission denied by Gemini API. Check your API key permissions in Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || explicitStatus === 429) {
    return {
      status: 429,
      message:
        'Free-tier Gemini API quota or Search Grounding rate limit reached (429). Switch to Fast or Deep SLA mode, or add a billing-enabled API key in Settings > Secrets.',
    };
  }
  if (typeof explicitStatus === 'number' && explicitStatus >= 400 && explicitStatus < 600) {
    return { status: explicitStatus, message: raw };
  }
  return { status: 500, message: raw || 'Unexpected server error calling Gemini API.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nagrikseva-api' });
  });

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const body = req.body as {
        messages?: ClientChatMessage[];
        mode?: ChatMode;
        language?: LanguageCode;
        contextSummary?: string;
      };

      const incomingMessages = Array.isArray(body?.messages) ? body.messages : [];
      const sanitized = incomingMessages
        .filter(
          (m): m is ClientChatMessage =>
            Boolean(m) &&
            (m.role === 'user' || m.role === 'model') &&
            typeof m.text === 'string' &&
            m.text.trim().length > 0
        )
        .slice(-20)
        .map((m) => ({
          role: m.role,
          text: m.text.trim().slice(0, 6000),
        }));

      if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== 'user') {
        res.status(400).json({ error: 'A non-empty user message is required.' });
        return;
      }

      const mode: ChatMode =
        body?.mode === 'fast' || body?.mode === 'deep' ? body.mode : 'search';
      const language: LanguageCode =
        body?.language === 'mr' || body?.language === 'hi' ? body.language : 'en';

      const ai = getGenAiClient();
      const systemInstruction = buildCivicSystemInstruction(language, body?.contextSummary);

      const latestMessage = sanitized[sanitized.length - 1].text;
      const history = sanitized.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const model = mode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

      const config: {
        systemInstruction: string;
        tools?: Array<{ googleSearch: Record<string, never> }>;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        systemInstruction,
      };

      if (mode === 'search') {
        config.tools = [{ googleSearch: {} }];
      } else if (mode === 'deep') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      const chat = ai.chats.create({
        model,
        history,
        config,
      });

      const response = await chat.sendMessage({
        message: latestMessage,
      });

      const reply = (response.text ?? '').trim();
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const groundingSources: GroundingSource[] = [];

      for (const chunk of chunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && !seenUris.has(uri)) {
          seenUris.add(uri);
          groundingSources.push({
            uri,
            title: title || uri,
          });
        }
        if (groundingSources.length >= 8) break;
      }

      res.json({
        reply: reply || 'No response generated. Please rephrase your civic question.',
        modelUsed: model,
        groundingSources,
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/gemini/transcribe', async (req, res) => {
    try {
      const body = req.body as {
        audioBase64?: string;
        mimeType?: string;
        language?: LanguageCode;
        purpose?: 'report' | 'chat';
      };

      const audioBase64 = typeof body?.audioBase64 === 'string' ? body.audioBase64.trim() : '';
      const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : 'audio/webm';

      if (!audioBase64) {
        res.status(400).json({ error: 'Recorded audio payload is required.' });
        return;
      }
      if (audioBase64.length > 14_000_000) {
        res.status(413).json({ error: 'Audio clip is too large. Please keep recordings under 60 seconds.' });
        return;
      }

      const ai = getGenAiClient();
      const languageHint =
        body?.language === 'mr'
          ? 'The speaker may speak in Marathi, Hindi, or English.'
          : body?.language === 'hi'
            ? 'The speaker may speak in Hindi, Marathi, or English.'
            : 'The speaker may speak in English, Hindi, or Marathi about Mira-Bhayandar civic issues.';

      const instruction =
        body?.purpose === 'report'
          ? `Transcribe this spoken civic complaint accurately as plain text without commentary or markdown. ${languageHint}`
          : `Transcribe this spoken user question accurately as plain text without commentary or markdown. ${languageHint}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: instruction },
          ],
        },
      });

      const transcript = (response.text ?? '').trim();
      res.json({
        transcript,
        modelUsed: 'gemini-3.5-transcribe',
      });
    } catch (error) {
      const mapped = mapGeminiError(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NagrikSeva full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NagrikSeva server:', err);
  process.exit(1);
});
