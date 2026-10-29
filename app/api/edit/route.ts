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
      model = 'Nano Banana 2.1',
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

  let generatedDataUrl: string | null = null;
  const cleanBase64 = imageBase64
    ? imageBase64.replace(/^data:image\/\w+;base64,/, '')
    : '';
  const resolvedMime = mimeType || 'image/png';

  const normalizedModel = model.trim();

  // 1. OpenAI Models: GPT Image 2.5 & GPT Image 2
  if (
    (normalizedModel === 'GPT Image 2.5' ||
      normalizedModel === 'GPT Image 2' ||
      normalizedModel === 'gpt-image') &&
    cleanBase64
  ) {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey !== 'MY_OPENAI_API_KEY') {
      try {
        const binaryBuf = Buffer.from(cleanBase64, 'base64');
        const blob = new Blob([binaryBuf], { type: resolvedMime });
        const formData = new FormData();
        formData.append('model', 'gpt-image-1');
        formData.append('image', blob, 'source.png');
        formData.append('prompt', prompt);
        formData.append(
          'quality',
          normalizedModel === 'GPT Image 2.5' ? 'high' : 'medium'
        );

        const openaiRes = await fetch(
          'https://api.openai.com/v1/images/edits',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${openaiKey}`,
            },
            body: formData,
          }
        );

        if (openaiRes.ok) {
          const data = await openaiRes.json();
          const b64Json = data?.data?.[0]?.b64_json;
          if (b64Json) {
            generatedDataUrl = `data:image/png;base64,${b64Json}`;
          }
        }
      } catch {
        generatedDataUrl = null;
      }
    }
  }
  // 2. Alibaba Qwen Model: Qwen Image 3 Pro
  else if (normalizedModel === 'Qwen Image 3 Pro' && cleanBase64) {
    const dashscopeKey = process.env.DASHSCOPE_API_KEY;
    if (dashscopeKey && dashscopeKey !== 'MY_DASHSCOPE_API_KEY') {
      try {
        const qwenRes = await fetch(
          'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${dashscopeKey}`,
            },
            body: JSON.stringify({
              model: 'qwen-image-edit',
              input: {
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        image: `data:${resolvedMime};base64,${cleanBase64}`,
                      },
                      { text: prompt },
                    ],
                  },
                ],
              },
            }),
          }
        );
        if (qwenRes.ok) {
          const qData = await qwenRes.json();
          const outImageUrl =
            qData?.output?.choices?.[0]?.message?.content?.[0]?.image;
          if (outImageUrl && typeof outImageUrl === 'string') {
            generatedDataUrl = outImageUrl;
          }
        }
      } catch {
        generatedDataUrl = null;
      }
    }
  }
  // 3. Google Gemini Models: Nano Banana 2.1, Nano Banana 2, Nano Banana Pro
  else if (cleanBase64) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        let targetGeminiModel = 'gemini-3.1-flash-lite-image';
        if (
          normalizedModel === 'Nano Banana 2.1' ||
          normalizedModel === 'gemini-nano-banana-2.1'
        ) {
          targetGeminiModel = 'gemini-nano-banana-2.1';
        } else if (
          normalizedModel === 'Nano Banana Pro' ||
          normalizedModel === 'gemini-3-pro-image'
        ) {
          targetGeminiModel = 'gemini-3-pro-image';
        } else if (
          normalizedModel === 'Nano Banana 2' ||
          normalizedModel === 'gemini-3.1-flash-lite-image'
        ) {
          targetGeminiModel = 'gemini-3.1-flash-lite-image';
        }

        const response = await ai.models.generateContent({
          model: targetGeminiModel,
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: resolvedMime,
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
  }

  const latest = store.get(jobId);
  if (!latest) return;
  latest.status = 'completed';
  latest.resultImageUrl = generatedDataUrl;
  latest.updatedAt = Date.now();
  store.set(jobId, latest);
}
