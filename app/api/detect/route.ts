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
                text: 'Analyze this image and extract all visible text blocks (Arabic and English). Return a JSON array where each item has: id (integer), label ("headline"|"subtitle"|"phone"|"body"|"logo_text"|"badge"), position ("top right"|"top center"|"top left"|"center"|"bottom center"|"bottom right"|"bottom left"), text (exact visible text), box_2d ([ymin, xmin, ymax, xmax] as integers from 0 to 1000 representing the exact bounding box of the text block), textColor (hex color of the text e.g. "#FFFFFF"), and bgColor (hex color of the background behind the text e.g. "#1E293B").',
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
                  box_2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description:
                      'Bounding box [ymin, xmin, ymax, xmax] normalized from 0 to 1000',
                  },
                  textColor: {
                    type: Type.STRING,
                    description: 'Hex color of the text e.g. #FFFFFF',
                  },
                  bgColor: {
                    type: Type.STRING,
                    description:
                      'Hex color of the background behind the text e.g. #1E293B',
                  },
                },
                required: ['id', 'label', 'position', 'text', 'box_2d'],
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
            texts: parsed.map((item, idx) => {
              let computedBox:
                | {
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    color?: string;
                    bgColor?: string;
                  }
                | undefined = undefined;

              if (Array.isArray(item.box_2d) && item.box_2d.length >= 4) {
                const rawYmin = Number(item.box_2d[0]) || 0;
                const rawXmin = Number(item.box_2d[1]) || 0;
                const rawYmax = Number(item.box_2d[2]) || 0;
                const rawXmax = Number(item.box_2d[3]) || 0;

                // Determine if model returned 0..1000 or 0..100 or 0..1
                const maxCoord = Math.max(rawYmin, rawXmin, rawYmax, rawXmax);
                const divisor = maxCoord > 100 ? 10 : maxCoord <= 1 ? 0.01 : 1;

                const yPct = Math.max(0, Math.min(96, rawYmin / divisor));
                const xPct = Math.max(0, Math.min(96, rawXmin / divisor));
                const hPct = Math.max(
                  3,
                  Math.min(100 - yPct, (rawYmax - rawYmin) / divisor)
                );
                const wPct = Math.max(
                  6,
                  Math.min(100 - xPct, (rawXmax - rawXmin) / divisor)
                );

                computedBox = {
                  x: xPct,
                  y: yPct,
                  width: wPct,
                  height: hPct,
                  color:
                    typeof item.textColor === 'string' &&
                    item.textColor.startsWith('#')
                      ? item.textColor
                      : undefined,
                  bgColor:
                    typeof item.bgColor === 'string' &&
                    item.bgColor.startsWith('#')
                      ? item.bgColor
                      : undefined,
                };
              }

              return {
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
                box: computedBox,
              };
            }),
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
