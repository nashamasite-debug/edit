import { FontStyleType } from './poster-renderer';

export type ModelProviderType = 'gemini' | 'openai' | 'qwen';

export type EditModelId =
  | 'Nano Banana 2.1'
  | 'Nano Banana 2'
  | 'Nano Banana Pro'
  | 'GPT Image 2.5'
  | 'GPT Image 2'
  | 'Qwen Image 3 Pro';

export interface ImageEditModelSpec {
  id: EditModelId;
  name: string;
  technicalModelId: string;
  provider: ModelProviderType;
  providerLabel: string;
  enabled: boolean;
  creditCost: number;
  speedLabel: string;
  qualityLabel: string;
  shortDesc: string;
  envVarName: 'GEMINI_API_KEY' | 'OPENAI_API_KEY' | 'DASHSCOPE_API_KEY';
  secondaryEnvVarName?: string;
  portalName: string;
  portalUrl: string;
  endpointUrl: string;
  whereToGetApi: string;
  stepsToGetAndAddApi: string[];
  envSnippet: string;
  serverExampleSnippet: string;
}

export interface CreditPackageSpec {
  id: string;
  title: string;
  credits: number;
  price: string;
  desc: string;
  popular?: boolean;
}

export interface SiteAdminConfig {
  general: {
    siteTitle: string;
    siteSubtitle: string;
    primaryColor: string;
    welcomeBannerText: string;
    footerText: string;
    maintenanceMode: boolean;
  };
  models: {
    defaultModelId: EditModelId;
    enableTransparentInpaintFallback: boolean;
    items: ImageEditModelSpec[];
  };
  ocr: {
    primaryVisionModel:
      | 'gemini-3.1-flash-lite'
      | 'gemini-3.8-flash'
      | 'gemini-flash-latest';
    compressionMaxDim: number;
    defaultFontStyle: FontStyleType;
    defaultFontWeight: string;
    disableSafetyFilters: boolean;
    seamlessInpaintRadius: number;
  };
  features: {
    enableBatchMode: boolean;
    enableCompareSlider: boolean;
    enableHoverEffectPreview: boolean;
    enableAutoDownloadOption: boolean;
    enableTabCreate: boolean;
    enableTabAiTools: boolean;
    enableTabBackground: boolean;
    enableTabAdjust: boolean;
    enableTabEffects: boolean;
    enableToolTextEditor: boolean;
    enableToolEditableLayers: boolean;
    enableToolMagicEraser: boolean;
    enableToolEnhanceHd: boolean;
  };
  billing: {
    welcomeCredits: number;
    freeRetryEnabled: boolean;
    packages: CreditPackageSpec[];
  };
  updatedAt: string;
}

export const INITIAL_IMAGE_EDIT_MODELS: ImageEditModelSpec[] = [
  {
    id: 'Nano Banana 2.1',
    name: 'Nano Banana 2.1',
    technicalModelId: 'gemini-nano-banana-2.1',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    enabled: true,
    creditCost: 1,
    speedLabel: 'سريع جداً (2–4 ثوانٍ)',
    qualityLabel: 'دقة فائقة 1K / 2K / 4K',
    shortDesc:
      'الجيل الأحدث من Google Gemini لتحرير النصوص داخل الصور بدقة 4K مع الحفاظ التام على تفاصيل الخلفية والخطوط العربية والإنجليزية.',
    envVarName: 'GEMINI_API_KEY',
    portalName: 'Google AI Studio',
    portalUrl: 'https://aistudio.google.com/apikey',
    endpointUrl:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1:generateContent',
    whereToGetApi:
      'من منصة Google AI Studio الرسمية (قسم API Keys) أو من Google Cloud Console (Vertex AI / Generative Language API).',
    stepsToGetAndAddApi: [
      'افتح منصة Google AI Studio عبر الرابط الرسمي: https://aistudio.google.com/apikey وسجّل الدخول بحساب Google الخاص بك.',
      'اضغط على زر "Create API Key" في أعلى الصفحة واختر مشروع Google Cloud الخاص بك (يفضّل ربط حساب الفوترة Pay-as-you-go لفتح حدود توليد الصور العالية).',
      'انسخ المفتاح الظاهر أمامك (يبدأ عادةً بـ AIzaSy...).',
      'في إعدادات المشروع داخل AI Studio، افتح لوحة "Settings > Secrets" (أو ملف البيئة .env على الخادم) وأضف المتغير باسم GEMINI_API_KEY وضع بداخله المفتاح.',
      'أعد تشغيل الخادم أو احفظ الإعدادات؛ سيقوم مسار الخادم (/api/edit) تلقائياً باستدعاء طراز gemini-nano-banana-2.1 دون كشف المفتاح للمتصفح.',
    ],
    envSnippet: 'GEMINI_API_KEY="AIzaSyYourGoogleGeminiApiKeyHere"',
    serverExampleSnippet: `import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-nano-banana-2.1",
  contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: prompt }] }
});`,
  },
  {
    id: 'Nano Banana 2',
    name: 'Nano Banana 2',
    technicalModelId: 'gemini-3.1-flash-lite-image',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    enabled: true,
    creditCost: 1,
    speedLabel: 'فوري (1–2 ثانية)',
    qualityLabel: 'دقة قياسية سريعة',
    shortDesc:
      'نموذج خفيف وسريع جداً من عائلة Gemini لتعديل النصوص اليومية والإعلانات السريعة بأقل استهلاك للرصيد.',
    envVarName: 'GEMINI_API_KEY',
    portalName: 'Google AI Studio',
    portalUrl: 'https://aistudio.google.com/apikey',
    endpointUrl:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent',
    whereToGetApi:
      'من نفس لوحة مفاتيح Google AI Studio الرسمية عبر الرابط https://aistudio.google.com/apikey (يعمل بنفس مفتاح GEMINI_API_KEY).',
    stepsToGetAndAddApi: [
      'انتقل إلى https://aistudio.google.com/apikey وسجّل الدخول بحسابك في Google.',
      'اضغط على "Create API Key" لإنشاء مفتاح جديد أو استخدم مفتاحك الحالي.',
      'أضف المفتاح في متغير البيئة GEMINI_API_KEY داخل لوحة Secrets أو ملف .env.',
      'ملاحظة: جميع نماذج عائلة Nano Banana (2.1 و 2 و Pro) تتشارك نفس المفتاح GEMINI_API_KEY ولا تحتاج لمفاتيح منفصلة.',
    ],
    envSnippet: 'GEMINI_API_KEY="AIzaSyYourGoogleGeminiApiKeyHere"',
    serverExampleSnippet: `import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-lite-image",
  contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: prompt }] }
});`,
  },
  {
    id: 'Nano Banana Pro',
    name: 'Nano Banana Pro',
    technicalModelId: 'gemini-3-pro-image',
    provider: 'gemini',
    providerLabel: 'Google Gemini',
    enabled: true,
    creditCost: 2,
    speedLabel: 'متوازن (3–6 ثوانٍ)',
    qualityLabel: 'دقة احترافية Pro',
    shortDesc:
      'الإصدار الاحترافي العميق لمعالجة البوسترات الإعلانية المعقدة والظلال والتدرجات اللونية المتداخلة مع الحروف.',
    envVarName: 'GEMINI_API_KEY',
    portalName: 'Google AI Studio / Cloud Console',
    portalUrl: 'https://aistudio.google.com/apikey',
    endpointUrl:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent',
    whereToGetApi:
      'من منصة Google AI Studio (https://aistudio.google.com/apikey) مع تفعيل الفوترة (Billing) لدعم طراز Pro.',
    stepsToGetAndAddApi: [
      'افتح https://aistudio.google.com/apikey وتأكد أن المشروع المرتبط بالمفتاح مفعل به نظام الفوترة (Tier 1 أو أعلى).',
      'انسخ مفتاح الـ API الخاص بك من القائمة.',
      'ضعه في المتغير GEMINI_API_KEY داخل إعدادات البيئة (.env أو Secrets).',
      'عند اختيار المستخدم لـ Nano Banana Pro سيقوم الخادم بتوجيه الطلب مباشرة إلى طراز gemini-3-pro-image.',
    ],
    envSnippet: 'GEMINI_API_KEY="AIzaSyYourGoogleGeminiApiKeyHere"',
    serverExampleSnippet: `import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const response = await ai.models.generateContent({
  model: "gemini-3-pro-image",
  contents: { parts: [{ inlineData: { data: base64, mimeType } }, { text: prompt }] }
});`,
  },
  {
    id: 'GPT Image 2.5',
    name: 'GPT Image 2.5',
    technicalModelId: 'gpt-image-1',
    provider: 'openai',
    providerLabel: 'OpenAI',
    enabled: true,
    creditCost: 2,
    speedLabel: 'متوازن (4–8 ثوانٍ)',
    qualityLabel: 'دقة طباعية فائقة HD',
    shortDesc:
      'أحدث نموذج تحرير صور من OpenAI متميز في فهم الأوامر الدقيقة وإعادة رسم النصوص داخل الصور مع مطابقة الإضاءة.',
    envVarName: 'OPENAI_API_KEY',
    portalName: 'OpenAI Developer Platform',
    portalUrl: 'https://platform.openai.com/api-keys',
    endpointUrl: 'https://api.openai.com/v1/images/edits',
    whereToGetApi:
      'من منصة مطوري OpenAI الرسمية عبر الرابط https://platform.openai.com/api-keys.',
    stepsToGetAndAddApi: [
      'ادخل إلى منصة OpenAI للمطورين عبر الرابط: https://platform.openai.com/api-keys وسجّل الدخول.',
      'من القائمة الجانبية انتقل إلى Settings > Billing وتأكد من وجود رصيد مشحون (على الأقل 5$) لتفعيل نقاط نهاية الصور.',
      'ارجع إلى صفحة API Keys واضغط على الزر الأخضر "+ Create new secret key".',
      'اختر صلاحيات المفتاح "All" ثم انسخ المفتاح السري الذي يبدأ بـ sk-proj-...',
      'في إعدادات بيئة المشروع (.env أو لوحة Settings > Secrets)، أضف المتغير OPENAI_API_KEY وضع قيمة المفتاح بداخله.',
    ],
    envSnippet: 'OPENAI_API_KEY="sk-proj-YourOpenAiSecretKeyHere"',
    serverExampleSnippet: `// Server-side call in /app/api/edit/route.ts
const res = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.OPENAI_API_KEY}\` },
  body: formData // model: "gpt-image-1", image, prompt
});`,
  },
  {
    id: 'GPT Image 2',
    name: 'GPT Image 2',
    technicalModelId: 'gpt-image-1',
    provider: 'openai',
    providerLabel: 'OpenAI',
    enabled: true,
    creditCost: 1,
    speedLabel: 'سريع (3–5 ثوانٍ)',
    qualityLabel: 'دقة قياسية عالية',
    shortDesc:
      'الإصدار القياسي السريع من OpenAI لتحرير الصور وتعديل النصوص الإعلانية بتكلفة رصيد اقتصادية.',
    envVarName: 'OPENAI_API_KEY',
    portalName: 'OpenAI Developer Platform',
    portalUrl: 'https://platform.openai.com/api-keys',
    endpointUrl: 'https://api.openai.com/v1/images/edits',
    whereToGetApi:
      'من منصة OpenAI Platform الرسمية (https://platform.openai.com/api-keys) — يعمل بنفس مفتاح OPENAI_API_KEY.',
    stepsToGetAndAddApi: [
      'انتقل إلى https://platform.openai.com/api-keys.',
      'أنشئ مفتاح Secret Key جديد يبدأ بـ sk-proj-... أو استخدم مفتاح OpenAI الحالي.',
      'أضف المفتاح في متغير البيئة OPENAI_API_KEY في ملف .env أو لوحة Secrets.',
      'يعمل كل من GPT Image 2.5 و GPT Image 2 تلقائياً فور توفير مفتاح OPENAI_API_KEY.',
    ],
    envSnippet: 'OPENAI_API_KEY="sk-proj-YourOpenAiSecretKeyHere"',
    serverExampleSnippet: `// Server-side call in /app/api/edit/route.ts
const res = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.OPENAI_API_KEY}\` },
  body: formData // model: "gpt-image-1", quality: "medium", image, prompt
});`,
  },
  {
    id: 'Qwen Image 3 Pro',
    name: 'Qwen Image 3 Pro',
    technicalModelId: 'qwen-image-edit',
    provider: 'qwen',
    providerLabel: 'Alibaba Qwen',
    enabled: true,
    creditCost: 1,
    speedLabel: 'سريع (2–5 ثوانٍ)',
    qualityLabel: 'دقة عالية متعددة اللغات',
    shortDesc:
      'نموذج Qwen 3 Pro من Alibaba Cloud المتخصص في تفريغ وتعديل النصوص متعددة اللغات داخل الصور بدقة بيكسل عالية.',
    envVarName: 'DASHSCOPE_API_KEY',
    secondaryEnvVarName: 'OPENROUTER_API_KEY',
    portalName: 'Alibaba Cloud Model Studio (DashScope) / OpenRouter',
    portalUrl: 'https://modelstudio.console.alibabacloud.com/',
    endpointUrl:
      'https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
    whereToGetApi:
      'من منصة Alibaba Cloud Model Studio (DashScope) الرسمية عبر https://modelstudio.console.alibabacloud.com/ أو عبر منصة OpenRouter (https://openrouter.ai/keys).',
    stepsToGetAndAddApi: [
      'افتح منصة Alibaba Cloud Model Studio عبر الرابط: https://modelstudio.console.alibabacloud.com/ (أو استخدم OpenRouter عبر https://openrouter.ai/keys).',
      'من القائمة الجانبية اختر "API-KEY Management" ثم اضغط على "Create API Key".',
      'انسخ المفتاح الذي يبدأ بـ sk-... الخاص بخدمة DashScope.',
      'أضف المتغير DASHSCOPE_API_KEY في ملف البيئة .env أو لوحة Settings > Secrets في الخادم (أو أضف OPENROUTER_API_KEY إذا كنت تستخدم بوابة OpenRouter).',
    ],
    envSnippet:
      'DASHSCOPE_API_KEY="sk-YourAlibabaDashScopeKeyHere"\n# أو اختيارياً عبر OpenRouter:\nOPENROUTER_API_KEY="sk-or-v1-YourOpenRouterKeyHere"',
    serverExampleSnippet: `// Server-side call in /app/api/edit/route.ts
const res = await fetch("https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.DASHSCOPE_API_KEY}\`
  },
  body: JSON.stringify({
    model: "qwen-vl-max",
    input: { messages: [{ role: "user", content: [{ image: dataUrl }, { text: prompt }] }] }
  })
});`,
  },
];

export const DEFAULT_SITE_ADMIN_CONFIG: SiteAdminConfig = {
  general: {
    siteTitle: 'AI Text Editor Studio',
    siteSubtitle: 'محرر النصوص الذكي داخل الصور مع الحفاظ على الخلفية والخط',
    primaryColor: '#8B7CF6',
    welcomeBannerText:
      'استبدل أي نص داخل الصور بنفس نوع الخط وبخلفية شفافة 100% دون أي أثر للتعديل',
    footerText: 'AI Text Editor Studio · جميع الحقوق محفوظة',
    maintenanceMode: false,
  },
  models: {
    defaultModelId: 'GPT Image 2.5',
    enableTransparentInpaintFallback: true,
    items: INITIAL_IMAGE_EDIT_MODELS,
  },
  ocr: {
    primaryVisionModel: 'gemini-3.1-flash-lite',
    compressionMaxDim: 1152,
    defaultFontStyle: 'times_new_roman',
    defaultFontWeight: '700',
    disableSafetyFilters: true,
    seamlessInpaintRadius: 4,
  },
  features: {
    enableBatchMode: true,
    enableCompareSlider: true,
    enableHoverEffectPreview: true,
    enableAutoDownloadOption: true,
    enableTabCreate: true,
    enableTabAiTools: true,
    enableTabBackground: true,
    enableTabAdjust: true,
    enableTabEffects: true,
    enableToolTextEditor: true,
    enableToolEditableLayers: true,
    enableToolMagicEraser: true,
    enableToolEnhanceHd: true,
  },
  billing: {
    welcomeCredits: 15,
    freeRetryEnabled: true,
    packages: [
      {
        id: 'pkg_starter',
        title: 'باقة البداية',
        credits: 25,
        price: '$5',
        desc: 'مثالية للتجربة والتصاميم الفردية',
      },
      {
        id: 'pkg_pro',
        title: 'باقة المحترفين',
        credits: 100,
        price: '$15',
        desc: 'الأكثر طلباً لصناع المحتوى والمسوقين',
        popular: true,
      },
      {
        id: 'pkg_agency',
        title: 'باقة الوكالات',
        credits: 300,
        price: '$39',
        desc: 'لتعديل الدفعات الكبيرة والحملات الإعلانية',
      },
    ],
  },
  updatedAt: new Date().toISOString(),
};

export const SITE_CONFIG_STORAGE_KEY = 'ai_text_studio_admin_config_v1';

export function loadLocalSiteConfig(): SiteAdminConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_SITE_ADMIN_CONFIG;
  }
  try {
    const raw = window.localStorage.getItem(SITE_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_ADMIN_CONFIG;
    const parsed = JSON.parse(raw) as Partial<SiteAdminConfig>;
    return mergeSiteAdminConfig(parsed);
  } catch {
    return DEFAULT_SITE_ADMIN_CONFIG;
  }
}

export function saveLocalSiteConfig(config: SiteAdminConfig): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SITE_CONFIG_STORAGE_KEY,
      JSON.stringify(config)
    );
    window.dispatchEvent(new Event('site-admin-config-updated'));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeSiteAdminConfig(
  partial?: Partial<SiteAdminConfig> | null
): SiteAdminConfig {
  if (!partial) return DEFAULT_SITE_ADMIN_CONFIG;

  const mergedModels = INITIAL_IMAGE_EDIT_MODELS.map((defaultModel) => {
    const found = partial.models?.items?.find((m) => m.id === defaultModel.id);
    if (!found) return defaultModel;
    return {
      ...defaultModel,
      enabled:
        typeof found.enabled === 'boolean'
          ? found.enabled
          : defaultModel.enabled,
      creditCost:
        typeof found.creditCost === 'number'
          ? found.creditCost
          : defaultModel.creditCost,
      shortDesc: found.shortDesc || defaultModel.shortDesc,
      speedLabel: found.speedLabel || defaultModel.speedLabel,
      qualityLabel: found.qualityLabel || defaultModel.qualityLabel,
    };
  });

  return {
    general: {
      ...DEFAULT_SITE_ADMIN_CONFIG.general,
      ...(partial.general || {}),
    },
    models: {
      defaultModelId:
        partial.models?.defaultModelId ||
        DEFAULT_SITE_ADMIN_CONFIG.models.defaultModelId,
      enableTransparentInpaintFallback:
        typeof partial.models?.enableTransparentInpaintFallback === 'boolean'
          ? partial.models.enableTransparentInpaintFallback
          : DEFAULT_SITE_ADMIN_CONFIG.models.enableTransparentInpaintFallback,
      items: mergedModels,
    },
    ocr: {
      ...DEFAULT_SITE_ADMIN_CONFIG.ocr,
      ...(partial.ocr || {}),
    },
    features: {
      ...DEFAULT_SITE_ADMIN_CONFIG.features,
      ...(partial.features || {}),
    },
    billing: {
      welcomeCredits:
        typeof partial.billing?.welcomeCredits === 'number'
          ? partial.billing.welcomeCredits
          : DEFAULT_SITE_ADMIN_CONFIG.billing.welcomeCredits,
      freeRetryEnabled:
        typeof partial.billing?.freeRetryEnabled === 'boolean'
          ? partial.billing.freeRetryEnabled
          : DEFAULT_SITE_ADMIN_CONFIG.billing.freeRetryEnabled,
      packages:
        Array.isArray(partial.billing?.packages) &&
        partial.billing.packages.length > 0
          ? partial.billing.packages
          : DEFAULT_SITE_ADMIN_CONFIG.billing.packages,
    },
    updatedAt: partial.updatedAt || DEFAULT_SITE_ADMIN_CONFIG.updatedAt,
  };
}
