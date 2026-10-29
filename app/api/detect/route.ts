import { NextRequest, NextResponse } from 'next/server';
import {
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  Type,
} from '@google/genai';

const VISION_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageBase64, mimeType } = body as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'يرجى رفع صورة أولاً قبل طلب التعرّف على النصوص.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json(
        {
          error:
            'يرجى التحقق من مفتاح GEMINI_API_KEY في لوحة Settings > Secrets.',
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
    let lastError: unknown = null;

    for (const modelName of VISION_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: 'Analyze this image and extract all visible text blocks (Arabic and English). Return a JSON array where each item has: id (integer), label ("headline"|"subtitle"|"phone"|"body"|"logo_text"|"badge"), position ("top right"|"top center"|"top left"|"center"|"bottom center"|"bottom right"|"bottom left"), text (exact visible text), and box ({x, y, width, height} as percentages from 0 to 100 representing the bounding box of that text block on the image).',
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
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  label: {
                    type: Type.STRING,
                    description:
                      'One of: headline, subtitle, phone, body, logo_text, badge',
                  },
                  position: {
                    type: Type.STRING,
                    description:
                      'Spatial position such as top right, top center, center, bottom center, bottom left',
                  },
                  text: {
                    type: Type.STRING,
                    description: 'Exact text currently visible in the image',
                  },
                  box: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      width: { type: Type.NUMBER },
                      height: { type: Type.NUMBER },
                      color: {
                        type: Type.STRING,
                        description: 'Hex color of the text e.g. #FFFFFF',
                      },
                      bgColor: {
                        type: Type.STRING,
                        description:
                          'Hex color of the background behind the text e.g. #1E293B',
                      },
                    },
                    required: ['x', 'y', 'width', 'height'],
                  },
                },
                required: ['id', 'label', 'position', 'text'],
              },
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '[]').trim());
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) {
            return NextResponse.json(
              {
                error: 'لم يتم العثور على أي نصوص واضحة داخل الصورة المرفوعة.',
              },
              { status: 422 }
            );
          }

          return NextResponse.json({
            texts: parsed.map((item, idx) => ({
              id: Number(item.id) || idx + 1,
              label: [
                'headline',
                'subtitle',
                'phone',
                'body',
                'logo_text',
                'badge',
              ].includes(item.label)
                ? item.label
                : 'body',
              position: item.position || 'center',
              text: item.text || '',
              box:
                item.box &&
                typeof item.box.x === 'number' &&
                typeof item.box.y === 'number'
                  ? {
                      x: Math.max(0, Math.min(95, Number(item.box.x))),
                      y: Math.max(0, Math.min(95, Number(item.box.y))),
                      width: Math.max(
                        5,
                        Math.min(100, Number(item.box.width) || 60)
                      ),
                      height: Math.max(
                        4,
                        Math.min(50, Number(item.box.height) || 10)
                      ),
                      color:
                        typeof item.box.color === 'string'
                          ? item.box.color
                          : undefined,
                      bgColor:
                        typeof item.box.bgColor === 'string'
                          ? item.box.bgColor
                          : undefined,
                    }
                  : undefined,
            })),
            source: modelName,
          });
        }
      } catch (err) {
        lastError = err;
      }
    }

    const errMsg =
      lastError instanceof Error ? lastError.message : String(lastError || '');
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(
        {
          error:
            'تم استهلاك الحصة المجانية اليومية للمفتاح الحالي (429). يمكنك اختيار مفتاح مفعل به الفوترة من Settings > Secrets لزيادة الحصة.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error:
          'تعذّر تحليل النصوص في الصورة. يرجى التحقق من مفتاح API في Settings > Secrets والمحاولة مرة أخرى.',
      },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error in /api/detect:', error);
    return NextResponse.json(
      {
        error:
          'تعذّر تحليل النصوص في الصورة. يرجى المحاولة مرة أخرى، وتم الحفاظ على رصيدك.',
      },
      { status: 500 }
    );
  }
}
