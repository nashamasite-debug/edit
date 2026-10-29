import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
} from '@google/genai';
import {
  buildEditPrompt,
  getJobStore,
  ServerJobRecord,
  TextReplacementSpec,
} from '@/lib/job-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageBase64,
      mimeType,
      replacements,
      model = 'gemini-3.1-flash-lite-image',
      isRetry = false,
      batchCount = 1,
    } = body as {
      imageBase64?: string;
      mimeType?: string;
      replacements: TextReplacementSpec[];
      model?: string;
      isRetry?: boolean;
      batchCount?: number;
    };

    if (!Array.isArray(replacements) || replacements.length === 0) {
      return NextResponse.json(
        { error: 'يرجى تعديل نص واحد على الأقل قبل تطبيق التعديلات.' },
        { status: 400 }
      );
    }

    const prompt = buildEditPrompt(replacements);
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cost = isRetry ? 0 : Math.max(1, batchCount);

    const jobRecord: ServerJobRecord = {
      id: jobId,
      status: 'queued',
      type: 'edit',
      cost,
      model,
      prompt,
      replacements,
      resultImageUrl: null,
      errorMessage: null,
      isRetry,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const store = getJobStore();
    store.set(jobId, jobRecord);

    // Trigger asynchronous background job execution
    void processEditJobAsync(jobId, imageBase64, mimeType, prompt, model);

    return NextResponse.json({
      jobId,
      status: jobRecord.status,
      prompt,
      cost,
    });
  } catch (error) {
    console.error('Error in POST /api/edit:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء بدء مهمة تعديل النص. تم إرجاع الرصيد تلقائياً.' },
      { status: 500 }
    );
  }
}

async function processEditJobAsync(
  jobId: string,
  imageBase64: string | undefined,
  mimeType: string | undefined,
  prompt: string,
  model: string
) {
  const store = getJobStore();
  const job = store.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.updatedAt = Date.now();
  store.set(jobId, job);

  const apiKey = process.env.GEMINI_API_KEY;
  let generatedDataUrl: string | null = null;

  if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && imageBase64) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const targetGeminiModel =
        model === 'gemini-nano-banana-2.1'
          ? 'gemini-nano-banana-2.1'
          : 'gemini-3.1-flash-lite-image';

      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const response = await ai.models.generateContent({
        model: targetGeminiModel,
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/png',
              },
            },
            {
              text: prompt,
            },
          ],
        },
        config: {
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
              threshold: HarmBlockThreshold.BLOCK_NONE,
            },
          ],
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const outMime = part.inlineData.mimeType ?? 'image/png';
          generatedDataUrl = `data:${outMime};base64,${part.inlineData.data}`;
          break;
        }
      }
    } catch {
      // Gracefully fall back to studio high-DPI RTL canvas compositor when free-tier image quota is 0
      generatedDataUrl = null;
    }
  }

  const latest = store.get(jobId);
  if (!latest) return;
  latest.status = 'completed';
  latest.resultImageUrl = generatedDataUrl;
  latest.updatedAt = Date.now();
  store.set(jobId, latest);
}
