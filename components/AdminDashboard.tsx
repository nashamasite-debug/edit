'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings,
  Cpu,
  Type as TypeIcon,
  Sliders,
  CreditCard,
  Activity,
  ExternalLink,
  Check,
  Copy,
  RotateCcw,
  Save,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Layers,
  RefreshCw,
  Search,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  DEFAULT_SITE_ADMIN_CONFIG,
  EditModelId,
  ImageEditModelSpec,
  loadLocalSiteConfig,
  mergeSiteAdminConfig,
  ModelProviderType,
  saveLocalSiteConfig,
  SiteAdminConfig,
} from '@/lib/ai-models-config';
import {
  FONT_STYLE_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  FontStyleType,
} from '@/lib/poster-renderer';

type AdminSectionId =
  | 'overview'
  | 'models_api'
  | 'ocr_fonts'
  | 'studio_features'
  | 'billing_credits'
  | 'jobs_log'
  | 'general_branding';

interface ServerJobSummary {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  type: string;
  cost: number;
  model: string;
  prompt: string;
  isRetry: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ProviderEnvStatus {
  GEMINI_API_KEY: boolean;
  OPENAI_API_KEY: boolean;
  DASHSCOPE_API_KEY: boolean;
  OPENROUTER_API_KEY: boolean;
}

export function ModelProviderBadge({
  provider,
}: {
  provider: ModelProviderType;
}) {
  if (provider === 'gemini') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 via-indigo-500 to-emerald-400 text-white text-xs font-bold shrink-0 shadow-2xs"
        title="Google Gemini / Nano Banana"
      >
        ✦
      </span>
    );
  }
  if (provider === 'openai') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold shrink-0"
        title="OpenAI GPT Image"
      >
        ◎
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-violet-600 text-white text-xs font-bold shrink-0"
      title="Alibaba Qwen Image"
    >
      ❖
    </span>
  );
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] =
    useState<AdminSectionId>('models_api');
  const [config, setConfig] = useState<SiteAdminConfig>(
    DEFAULT_SITE_ADMIN_CONFIG
  );
  const [providerStatus, setProviderStatus] = useState<ProviderEnvStatus>({
    GEMINI_API_KEY: true,
    OPENAI_API_KEY: false,
    DASHSCOPE_API_KEY: false,
    OPENROUTER_API_KEY: false,
  });
  const [recentJobs, setRecentJobs] = useState<ServerJobSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedGuideModelId, setSelectedGuideModelId] =
    useState<EditModelId>('Nano Banana 2.1');
  const [copiedKeyText, setCopiedKeyText] = useState<string | null>(null);
  const [jobSearchQuery, setJobSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [localStudioCredits, setLocalStudioCredits] = useState<number>(15);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      setToast({ text, type });
      setTimeout(() => {
        setToast((prev) => (prev?.text === text ? null : prev));
      }, 4000);
    },
    []
  );

  const fetchServerAdminState = useCallback(async () => {
    setIsLoading(true);
    try {
      const localCfg = loadLocalSiteConfig();
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.providerStatus) {
          setProviderStatus(data.providerStatus);
        }
        if (Array.isArray(data.recentJobs)) {
          setRecentJobs(data.recentJobs);
        }
        // Prefer local adjustments if already saved in browser, else merge server config
        const merged = mergeSiteAdminConfig(localCfg || data.config);
        setConfig(merged);
      } else {
        setConfig(localCfg);
      }
    } catch {
      setConfig(loadLocalSiteConfig());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServerAdminState();
    if (typeof window !== 'undefined') {
      const savedCreds = window.localStorage.getItem(
        'ai_text_studio_custom_credits'
      );
      if (savedCreds && !Number.isNaN(Number(savedCreds))) {
        setLocalStudioCredits(Number(savedCreds));
      }
    }
  }, [fetchServerAdminState]);

  const handleSaveAllSettings = async (nextConfig?: SiteAdminConfig) => {
    const targetConfig = nextConfig || config;
    setIsSaving(true);
    try {
      const updated: SiteAdminConfig = {
        ...targetConfig,
        updatedAt: new Date().toISOString(),
      };
      saveLocalSiteConfig(updated);
      setConfig(updated);

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: updated }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.providerStatus) {
          setProviderStatus(data.providerStatus);
        }
      }
      showToast(
        'تم حفظ جميع الإعدادات وتطبيقها فوراً على الاستوديو!',
        'success'
      );
    } catch {
      showToast('تم حفظ الإعدادات محلياً بنجاح.', 'info');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    await handleSaveAllSettings(DEFAULT_SITE_ADMIN_CONFIG);
    showToast('تمت استعادة الإعدادات الافتراضية للموقع.', 'info');
  };

  const handleCopyText = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKeyText(label);
      setTimeout(() => setCopiedKeyText(null), 2000);
    }
  };

  const handleToggleModelEnabled = (modelId: EditModelId) => {
    const enabledCount = config.models.items.filter((m) => m.enabled).length;
    const target = config.models.items.find((m) => m.id === modelId);
    if (target?.enabled && enabledCount <= 1) {
      showToast('يجب إبقاء نموذج واحد على الأقل مفعّلاً في المحرر.', 'error');
      return;
    }

    const nextItems = config.models.items.map((m) =>
      m.id === modelId ? { ...m, enabled: !m.enabled } : m
    );
    let nextDefault = config.models.defaultModelId;
    if (nextDefault === modelId && target?.enabled) {
      const firstRemaining = nextItems.find((m) => m.enabled);
      if (firstRemaining) nextDefault = firstRemaining.id;
    }

    const nextCfg: SiteAdminConfig = {
      ...config,
      models: {
        ...config.models,
        defaultModelId: nextDefault,
        items: nextItems,
      },
    };
    setConfig(nextCfg);
    saveLocalSiteConfig(nextCfg);
  };

  const handleUpdateModelCost = (modelId: EditModelId, newCost: number) => {
    const clamped = Math.max(0, Math.min(50, newCost));
    const nextCfg: SiteAdminConfig = {
      ...config,
      models: {
        ...config.models,
        items: config.models.items.map((m) =>
          m.id === modelId ? { ...m, creditCost: clamped } : m
        ),
      },
    };
    setConfig(nextCfg);
    saveLocalSiteConfig(nextCfg);
  };

  const handleSetDefaultModel = (modelId: EditModelId) => {
    const nextItems = config.models.items.map((m) =>
      m.id === modelId ? { ...m, enabled: true } : m
    );
    const nextCfg: SiteAdminConfig = {
      ...config,
      models: {
        ...config.models,
        defaultModelId: modelId,
        items: nextItems,
      },
    };
    setConfig(nextCfg);
    saveLocalSiteConfig(nextCfg);
    showToast(`تم تعيين «${modelId}» كنموذج افتراضي في الاستوديو`, 'success');
  };

  const handleGrantQuickCredits = (delta: number) => {
    const nextVal = Math.max(0, localStudioCredits + delta);
    setLocalStudioCredits(nextVal);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'ai_text_studio_custom_credits',
        String(nextVal)
      );
      window.dispatchEvent(new Event('site-admin-config-updated'));
    }
    showToast(`تم تحديث الرصيد المتاح في الاستوديو إلى ${nextVal} رصيد`, 'success');
  };

  const activeGuideModel: ImageEditModelSpec =
    config.models.items.find((m) => m.id === selectedGuideModelId) ||
    config.models.items[0];

  const enabledModelsCount = config.models.items.filter(
    (m) => m.enabled
  ).length;
  const connectedProvidersCount = [
    providerStatus.GEMINI_API_KEY,
    providerStatus.OPENAI_API_KEY,
    providerStatus.DASHSCOPE_API_KEY,
  ].filter(Boolean).length;

  const filteredJobs = recentJobs.filter((j) => {
    if (!jobSearchQuery.trim()) return true;
    const q = jobSearchQuery.toLowerCase();
    return (
      j.id.toLowerCase().includes(q) ||
      j.model.toLowerCase().includes(q) ||
      j.prompt.toLowerCase().includes(q) ||
      j.status.toLowerCase().includes(q)
    );
  });

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
    >
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%]">
          <div
            className={`px-4 py-3 rounded-xl border shadow-lg flex items-center justify-between gap-3 text-xs sm:text-sm font-bold ${
              toast.type === 'error'
                ? 'bg-red-950 text-red-100 border-red-800'
                : 'bg-slate-900 text-white border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOP HEADER BAR ==================== */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#8B7CF6] text-white flex items-center justify-center font-bold shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-slate-900 truncate">
              <span>لوحة تحكم الإدارة الشاملة</span>
              <span className="text-slate-300">/</span>
              <span className="text-[#8B7CF6] font-mono text-xs sm:text-sm">
                /admin
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate hidden sm:block">
              التحكم الكامل في نماذج تعديل الصور، مفاتيح الـ API، الخطوط، الأرصدة، وأدوات الاستوديو
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleSaveAllSettings()}
            disabled={isSaving}
            className="h-10 px-4 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ وتطبيق التغييرات'}</span>
          </button>

          <Link
            href="/"
            className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <span>العودة للاستوديو</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Link>
        </div>
      </header>

      {/* ==================== MAIN WORKSPACE (SIDEBAR + CONTENT) ==================== */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1440px] w-full mx-auto">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-72 bg-white border-b lg:border-b-0 lg:border-l border-slate-200 p-4 shrink-0">
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {(
              [
                {
                  id: 'models_api',
                  label: 'نماذج تعديل الصور ودليل الـ API',
                  icon: Cpu,
                },
                {
                  id: 'overview',
                  label: 'نظرة عامة والإحصائيات',
                  icon: Activity,
                },
                {
                  id: 'ocr_fonts',
                  label: 'التعرّف على النصوص والخطوط',
                  icon: TypeIcon,
                },
                {
                  id: 'studio_features',
                  label: 'أدوات وأقسام الاستوديو',
                  icon: Sliders,
                },
                {
                  id: 'billing_credits',
                  label: 'الأرصدة والباقات (Stripe)',
                  icon: CreditCard,
                },
                {
                  id: 'jobs_log',
                  label: 'سجل المهام والعمليات الحية',
                  icon: Layers,
                },
                {
                  id: 'general_branding',
                  label: 'إعدادات الموقع والهوية',
                  icon: Settings,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#8B7CF6]/10 text-[#8B7CF6]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Quick Summary Box inside Sidebar (Desktop) */}
          <div className="hidden lg:block mt-6 pt-6 border-t border-slate-200 space-y-3">
            <div className="text-xs font-bold text-slate-800">
              ملخص حالة المنصة
            </div>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>النموذج الافتراضي:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {config.models.defaultModelId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>النماذج المفعّلة:</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {enabledModelsCount} / {config.models.items.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>الخط الافتراضي:</span>
                <span className="font-bold text-slate-900">
                  Times New Roman ({config.ocr.defaultFontWeight})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>الرصيد الترحيبي:</span>
                <span className="font-bold text-[#8B7CF6] tabular-nums">
                  {config.billing.welcomeCredits} رصيد
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetToDefaults}
              className="w-full h-9 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة ضبط المصنع</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 space-y-8 overflow-y-auto">
          {/* =====================================================================
              SECTION 1: نماذج تعديل الصور ودليل الـ API (AI MODELS & API SETUP GUIDE)
             ===================================================================== */}
          {activeSection === 'models_api' && (
            <div className="space-y-8">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    نماذج تعديل الصور ودليل إعداد مفاتيح الـ API
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">
                    إدارة النماذج الستة المرفقة (`Nano Banana 2.1`, `Nano Banana 2`, `Nano Banana Pro`, `GPT Image 2.5`, `GPT Image 2`, `Qwen Image 3 Pro`) مع شرح تفصيلي لكيفية جلب وإضافة الـ API لكل نموذج
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void fetchServerAdminState()}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>فحص حالة المفاتيح</span>
                  </button>
                </div>
              </div>

              {/* Live Preview of the 6-Model Selector Menu + Global Fallback Setting */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Visual Menu Preview (Matching User Screenshot) */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">
                      معاينة قائمة النماذج في الاستوديو
                    </h2>
                    <span className="text-xs text-slate-500">
                      اضغط لتعيين الافتراضي
                    </span>
                  </div>

                  {/* Menu styled after the user's attached screenshot */}
                  <div
                    dir="ltr"
                    className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs space-y-1"
                  >
                    {config.models.items.map((model) => {
                      const isDefault =
                        config.models.defaultModelId === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedGuideModelId(model.id);
                            handleSetDefaultModel(model.id);
                          }}
                          className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                            isDefault
                              ? 'bg-slate-100/90 text-slate-900 font-bold'
                              : model.enabled
                              ? 'hover:bg-slate-50 text-slate-800 font-medium'
                              : 'opacity-45 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isDefault ? (
                              <Check className="w-4 h-4 text-slate-900 stroke-[2.5]" />
                            ) : (
                              <span className="w-4 h-4" />
                            )}
                            {!model.enabled && (
                              <span className="text-[10px] text-rose-600 font-semibold">
                                (معطّل)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm tracking-tight">
                              {model.name}
                            </span>
                            <ModelProviderBadge provider={model.provider} />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    النموذج المحدد بعلامة صح (✓) هو النموذج الافتراضي الذي يظهر للمستخدمين عند فتح أداة «محرر النصوص بالذكاء الاصطناعي».
                  </p>
                </div>

                {/* All 6 Models Control Table */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">
                      التحكم في تفعيل النماذج وتكلفة الرصيد وحالة الـ API
                    </h2>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {enabledModelsCount} نماذج مفعّلة
                    </span>
                  </div>

                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {config.models.items.map((model) => {
                      const isEnvConnected =
                        providerStatus[model.envVarName] || false;
                      const isSelectedForGuide =
                        selectedGuideModelId === model.id;

                      return (
                        <div
                          key={model.id}
                          onClick={() => setSelectedGuideModelId(model.id)}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelectedForGuide
                              ? 'bg-[#8B7CF6]/5'
                              : 'bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ModelProviderBadge provider={model.provider} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  dir="ltr"
                                  className="text-sm font-bold text-slate-900"
                                >
                                  {model.name}
                                </span>
                                <span className="text-slate-300">·</span>
                                <span className="text-xs text-slate-500">
                                  {model.providerLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                                <span className="font-mono">
                                  {model.envVarName}
                                </span>
                                <span>·</span>
                                <span
                                  className={
                                    isEnvConnected
                                      ? 'text-emerald-700 font-semibold'
                                      : 'text-amber-700 font-semibold'
                                  }
                                >
                                  {isEnvConnected
                                    ? 'مفتاح الـ API مضاف في الخادم'
                                    : 'يعمل بالدمج المحلي الشفاف (بانتظار المفتاح)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Cost per edit */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500">
                                التكلفة:
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                value={model.creditCost}
                                onChange={(e) =>
                                  handleUpdateModelCost(
                                    model.id,
                                    Number(e.target.value)
                                  )
                                }
                                className="w-14 h-8 px-2 rounded-lg border border-slate-200 text-xs font-bold text-center tabular-nums focus:border-[#8B7CF6] focus:outline-none"
                              />
                              <span className="text-[11px] text-slate-500">
                                رصيد
                              </span>
                            </div>

                            {/* Guide Button */}
                            <button
                              type="button"
                              onClick={() => setSelectedGuideModelId(model.id)}
                              className={`h-8 px-2.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                isSelectedForGuide
                                  ? 'border-[#8B7CF6] bg-[#8B7CF6] text-white'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              شرح الـ API
                            </button>

                            {/* Enable / Disable Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleModelEnabled(model.id)}
                              className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                model.enabled
                                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              }`}
                            >
                              {model.enabled ? 'مفعّل' : 'معطّل'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Transparent Fallback Option */}
                  <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={config.models.enableTransparentInpaintFallback}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          models: {
                            ...config.models,
                            enableTransparentInpaintFallback: e.target.checked,
                          },
                        })
                      }
                      className="mt-0.5 w-4 h-4 rounded accent-[#8B7CF6] cursor-pointer"
                    />
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-slate-900">
                        تفعيل محرك المسح الذكي بخلفية شفافة 100% (Seamless Glyph Inpainting Fallback):
                      </span>{' '}
                      يضمن استبدال النص بنفس نوع الخط ووزنه على الفور حتى في حال انتهاء حصة مفتاح الـ API المجانية أو عدم إضافة مفتاح خارجي بعد.
                    </div>
                  </label>
                </div>
              </div>

              {/* =====================================================================
                  DETAILED STEP-BY-STEP API GUIDE FOR EACH OF THE 6 MODELS
                 ===================================================================== */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-5 h-5 text-[#8B7CF6]" />
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      الدليل التفصيلي: كيفية جلب وإضافة مفتاح الـ API لكل نموذج
                    </h2>
                  </div>

                  {/* Model Tabs for Guide */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {config.models.items.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        dir="ltr"
                        onClick={() => setSelectedGuideModelId(m.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          selectedGuideModelId === m.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <ModelProviderBadge provider={m.provider} />
                        <span>{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Model Guide Card */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <ModelProviderBadge
                          provider={activeGuideModel.provider}
                        />
                        <div>
                          <h3
                            dir="ltr"
                            className="text-lg font-extrabold text-slate-900"
                          >
                            {activeGuideModel.name}
                          </h3>
                          <p className="text-xs text-slate-500">
                            المعرّف البرمجي:{' '}
                            <span className="font-mono font-bold text-slate-700">
                              {activeGuideModel.technicalModelId}
                            </span>{' '}
                            · المزوّد: {activeGuideModel.providerLabel}
                          </p>
                        </div>
                      </div>

                      <a
                        href={activeGuideModel.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-3.5 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>فتح موقع استخراج الـ API الرسمي</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      {activeGuideModel.shortDesc}
                    </p>

                    <div className="space-y-2">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        من أين أجلب مفتاح الـ API لنموذج {activeGuideModel.name}؟
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {activeGuideModel.whereToGetApi}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        خطوات الحصول على المفتاح وإضافته للمشروع بالتفصيل:
                      </h4>
                      <ol className="space-y-2">
                        {activeGuideModel.stepsToGetAndAddApi.map(
                          (step, index) => (
                            <li
                              key={index}
                              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed"
                            >
                              <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                {index + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          )
                        )}
                      </ol>
                    </div>
                  </div>

                  {/* Right Column: Environment Variable & Code Snippet */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          1. اسم متغير البيئة المطلوب في (.env أو Secrets):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              activeGuideModel.envSnippet,
                              'env_snippet'
                            )
                          }
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKeyText === 'env_snippet' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ المتغير</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre
                        dir="ltr"
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto"
                      >
                        {activeGuideModel.envSnippet}
                      </pre>

                      <div className="text-[11px] text-slate-400 leading-relaxed">
                        نقطة النهاية (Endpoint):{' '}
                        <span className="font-mono text-slate-300 break-all">
                          {activeGuideModel.endpointUrl}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900 text-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          2. كود الربط المدمج جاهزاً في الخادم (/api/edit):
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(
                              activeGuideModel.serverExampleSnippet,
                              'code_snippet'
                            )
                          }
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKeyText === 'code_snippet' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ الكود</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre
                        dir="ltr"
                        className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto leading-relaxed"
                      >
                        {activeGuideModel.serverExampleSnippet}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* All 6 Models Quick Reference Summary Table */}
                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    جدول مقارنة سريع لجميع النماذج الستة ومصادر الـ API الخاصة بها:
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3.5">اسم النموذج</th>
                          <th className="py-3 px-3.5">الشركة المزوّدة</th>
                          <th className="py-3 px-3.5">متغير البيئة (.env)</th>
                          <th className="py-3 px-3.5">من أين أجلب الـ API؟</th>
                          <th className="py-3 px-3.5">الرابط المباشر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {config.models.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td
                              dir="ltr"
                              className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap"
                            >
                              <div className="flex items-center justify-end gap-2">
                                <span>{item.name}</span>
                                <ModelProviderBadge provider={item.provider} />
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-slate-700 whitespace-nowrap">
                              {item.providerLabel}
                            </td>
                            <td className="py-3 px-3.5 font-mono font-bold text-[#8B7CF6] whitespace-nowrap">
                              {item.envVarName}
                            </td>
                            <td className="py-3 px-3.5 text-slate-600">
                              {item.portalName}
                            </td>
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <a
                                href={item.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#8B7CF6] hover:underline font-bold inline-flex items-center gap-1"
                              >
                                <span>فتح المنصة</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 2: نظرة عامة والإحصائيات (OVERVIEW & METRICS)
             ===================================================================== */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  نظرة عامة وإحصائيات المنصة
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  مؤشرات الأداء الحية، حالة مزوّدي الذكاء الاصطناعي، وإحصائيات المهام المنفذة
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="text-xs text-slate-500">
                    إجمالي نماذج الصور المفعّلة
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {enabledModelsCount} / {config.models.items.length}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    الافتراضي: {config.models.defaultModelId}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="text-xs text-slate-500">
                    مزوّدو الـ API المتصلون بالخادم
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                    {connectedProvidersCount} / 3
                  </div>
                  <div className="text-[11px] text-slate-500">
                    مع تفعيل الدمج الشفاف التلقائي
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="text-xs text-slate-500">
                    إجمالي المهام في الجلسة الحالية
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
                    {recentJobs.length}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    عبر مسار /api/edit و /api/detect
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <div className="text-xs text-slate-500">
                    رصيد الاستوديو الحالي
                  </div>
                  <div className="text-2xl font-extrabold text-[#8B7CF6] tabular-nums">
                    {localStudioCredits} رصيد
                  </div>
                  <div className="text-[11px] text-slate-500">
                    الرصيد الترحيبي للأعضاء: {config.billing.welcomeCredits}
                  </div>
                </div>
              </div>

              {/* Quick Navigation Cards to Other Admin Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('models_api')}
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#8B7CF6] text-right space-y-2 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-bold text-slate-900">
                    إدارة النماذج الستة ومفاتيح الـ API
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    تفعيل أو تعطيل Nano Banana و GPT Image و Qwen Image ومراجعة خطوات إضافة الـ API.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('ocr_fonts')}
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#8B7CF6] text-right space-y-2 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-bold text-slate-900">
                    إعدادات الخطوط (Times New Roman) والـ OCR
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ضبط سرعة قراءة النصوص، اختيار الخط والوزن الافتراضي (300–900)، ودقة المسح الشفاف.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('billing_credits')}
                  className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#8B7CF6] text-right space-y-2 transition-colors cursor-pointer"
                >
                  <div className="text-sm font-bold text-slate-900">
                    شحن وتعديل الأرصدة والباقات
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    إضافة رصيد فوري للاستوديو وتعديل أسعار وكميات باقات الشحن الثلاث.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 3: التعرّف على النصوص والخطوط (OCR & TYPOGRAPHY SETTINGS)
             ===================================================================== */}
          {activeSection === 'ocr_fonts' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  إعدادات التعرّف على النصوص (OCR) والخطوط والخلفية الشفافة
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  التحكم في سرعة قراءة النصوص، الخط الافتراضي (Times New Roman بكافة أوزانه)، وإزالة القيود الأمنية
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Primary OCR Model */}
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-900">
                      نموذج الرؤية الأساسي لاستخراج النصوص (/api/detect):
                    </label>
                    <select
                      value={config.ocr.primaryVisionModel}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          ocr: {
                            ...config.ocr,
                            primaryVisionModel: e.target
                              .value as SiteAdminConfig['ocr']['primaryVisionModel'],
                          },
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:border-[#8B7CF6] focus:outline-none"
                    >
                      <option value="gemini-3.1-flash-lite">
                        gemini-3.1-flash-lite (موصى به — فائق السرعة ~1.5 ثانية)
                      </option>
                      <option value="gemini-3.8-flash">
                        gemini-3.8-flash (تحليل عميق)
                      </option>
                      <option value="gemini-flash-latest">
                        gemini-flash-latest (البديل المستقر)
                      </option>
                    </select>
                  </div>

                  {/* Image Compression Max Dimension */}
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-900">
                      أقصى أبعاد لضغط الصورة قبل الفحص (لتسريع القراءة):
                    </label>
                    <select
                      value={config.ocr.compressionMaxDim}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          ocr: {
                            ...config.ocr,
                            compressionMaxDim: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:border-[#8B7CF6] focus:outline-none"
                    >
                      <option value={960}>960px (أسرع استجابة ممكنة)</option>
                      <option value={1152}>
                        1152px (متوازن مثالي للسرعة والدقة)
                      </option>
                      <option value={1440}>
                        1440px (دقة عالية للنصوص الصغيرة جداً)
                      </option>
                    </select>
                  </div>

                  {/* Default Font Family */}
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-900">
                      نوع الخط الافتراضي عند استبدال النصوص:
                    </label>
                    <select
                      value={config.ocr.defaultFontStyle}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          ocr: {
                            ...config.ocr,
                            defaultFontStyle: e.target.value as FontStyleType,
                          },
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:border-[#8B7CF6] focus:outline-none"
                    >
                      {(
                        Object.keys(FONT_STYLE_OPTIONS) as FontStyleType[]
                      ).map((fk) => (
                        <option key={fk} value={fk}>
                          {FONT_STYLE_OPTIONS[fk].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Default Font Weight */}
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-bold text-slate-900">
                      الوزن الافتراضي للخط (Times New Roman / الخطوط الأخرى):
                    </label>
                    <select
                      value={config.ocr.defaultFontWeight}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          ocr: {
                            ...config.ocr,
                            defaultFontWeight: e.target.value,
                          },
                        })
                      }
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-bold text-slate-800 focus:border-[#8B7CF6] focus:outline-none"
                    >
                      {FONT_WEIGHT_OPTIONS.map((wOpt) => (
                        <option key={wOpt.value} value={wOpt.value}>
                          {wOpt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Safety Filter Bypass Toggle */}
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>
                        إزالة جميع قيود الفلترة الأمنية (HarmBlockThreshold.BLOCK_NONE)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      يمنع حظر قراءة أو تعديل أي إعلانات أو ملصقات تجارية أثناء الفحص أو التوليد
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={config.ocr.disableSafetyFilters}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        ocr: {
                          ...config.ocr,
                          disableSafetyFilters: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 rounded accent-[#8B7CF6] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 4: أدوات وأقسام الاستوديو (STUDIO FEATURES & TOOLS)
             ===================================================================== */}
          {activeSection === 'studio_features' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  التحكم في أدوات وأقسام الاستوديو
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  تفعيل أو إخفاء التبويبات الخمسة، أدوات الذكاء الاصطناعي، ومزايا المعاينة والتنزيل
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bottom Sheet Tabs Control */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    التبويبات الرئيسية في المحرر
                  </h2>
                  <div className="space-y-3">
                    {(
                      [
                        {
                          key: 'enableTabAiTools',
                          label: 'تبويب أدوات الذكاء الاصطناعي',
                        },
                        {
                          key: 'enableTabCreate',
                          label: 'تبويب إنشاء / رفع صورة',
                        },
                        {
                          key: 'enableTabBackground',
                          label: 'تبويب تخصيص الخلفية',
                        },
                        {
                          key: 'enableTabAdjust',
                          label: 'تبويب ضبط الإضاءة والألوان',
                        },
                        {
                          key: 'enableTabEffects',
                          label: 'تبويب التأثيرات البصرية',
                        },
                      ] as const
                    ).map((t) => (
                      <label
                        key={t.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-slate-800">
                          {t.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={config.features[t.key]}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              features: {
                                ...config.features,
                                [t.key]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 rounded accent-[#8B7CF6] cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Studio Interactive Features Control */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    الأدوات والمزايا التفاعلية
                  </h2>
                  <div className="space-y-3">
                    {(
                      [
                        {
                          key: 'enableBatchMode',
                          label: 'وضع الدفعات (فردي | دفعة)',
                        },
                        {
                          key: 'enableCompareSlider',
                          label: 'شريط مقارنة (قبل / بعد)',
                        },
                        {
                          key: 'enableHoverEffectPreview',
                          label: 'المعاينة الحية للتأثيرات عند تمرير الفأرة (Hover)',
                        },
                        {
                          key: 'enableAutoDownloadOption',
                          label: 'خيار التنزيل التلقائي للصورة بعد التعديل',
                        },
                        {
                          key: 'enableToolMagicEraser',
                          label: 'أداة الممحاة السحرية للنصوص',
                        },
                        {
                          key: 'enableToolEnhanceHd',
                          label: 'أداة تحسين واستعادة الحدة (HD Upscale)',
                        },
                      ] as const
                    ).map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-slate-800">
                          {f.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={config.features[f.key]}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              features: {
                                ...config.features,
                                [f.key]: e.target.checked,
                              },
                            })
                          }
                          className="w-4 h-4 rounded accent-[#8B7CF6] cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 5: الأرصدة والباقات (BILLING, CREDITS & PACKAGES)
             ===================================================================== */}
          {activeSection === 'billing_credits' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  إدارة الأرصدة وباقات الشحن (Stripe)
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  التحكم في الرصيد الترحيبي المجاني، شحن رصيد فوري للاستوديو، وتعديل أسعار وكميات الباقات
                </p>
              </div>

              {/* Quick Credit Booster & Welcome Credits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    شحن وتعديل الرصيد الفوري في الاستوديو
                  </h2>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <div className="text-xs text-slate-500">
                        الرصيد الحالي في المتصفح
                      </div>
                      <div className="text-2xl font-extrabold text-[#8B7CF6] tabular-nums">
                        {localStudioCredits} رصيد
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {[15, 50, 100, 500].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleGrantQuickCredits(amt)}
                          className="h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer tabular-nums"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{amt}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                  <h2 className="text-sm font-bold text-slate-900">
                    إعدادات الرصيد الافتراضي للأعضاء الجدد
                  </h2>
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs sm:text-sm font-semibold text-slate-700">
                      الرصيد الترحيبي المجاني عند التسجيل:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10000}
                      value={config.billing.welcomeCredits}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          billing: {
                            ...config.billing,
                            welcomeCredits: Number(e.target.value),
                          },
                        })
                      }
                      className="w-24 h-10 px-3 rounded-xl border border-slate-200 text-sm font-bold text-center tabular-nums focus:border-[#8B7CF6] focus:outline-none"
                    />
                  </div>

                  <label className="flex items-center justify-between pt-2 border-t border-slate-100 cursor-pointer">
                    <span className="text-xs sm:text-sm font-semibold text-slate-700">
                      السماح بإعادة المحاولة المجانية (0 رصيد):
                    </span>
                    <input
                      type="checkbox"
                      checked={config.billing.freeRetryEnabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          billing: {
                            ...config.billing,
                            freeRetryEnabled: e.target.checked,
                          },
                        })
                      }
                      className="w-4 h-4 rounded accent-[#8B7CF6] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Editable Credit Packages */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                <h2 className="text-sm font-bold text-slate-900">
                  تخصيص باقات الشراء (Stripe Checkout Packages)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {config.billing.packages.map((pkg, idx) => (
                    <div
                      key={pkg.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 font-semibold">
                          اسم الباقة
                        </label>
                        <input
                          type="text"
                          value={pkg.title}
                          onChange={(e) => {
                            const nextPkgs = [...config.billing.packages];
                            nextPkgs[idx] = { ...pkg, title: e.target.value };
                            setConfig({
                              ...config,
                              billing: {
                                ...config.billing,
                                packages: nextPkgs,
                              },
                            });
                          }}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-500 font-semibold">
                            عدد الأرصدة
                          </label>
                          <input
                            type="number"
                            value={pkg.credits}
                            onChange={(e) => {
                              const nextPkgs = [...config.billing.packages];
                              nextPkgs[idx] = {
                                ...pkg,
                                credits: Number(e.target.value),
                              };
                              setConfig({
                                ...config,
                                billing: {
                                  ...config.billing,
                                  packages: nextPkgs,
                                },
                              });
                            }}
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold tabular-nums"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-slate-500 font-semibold">
                            السعر المعروض
                          </label>
                          <input
                            type="text"
                            value={pkg.price}
                            onChange={(e) => {
                              const nextPkgs = [...config.billing.packages];
                              nextPkgs[idx] = { ...pkg, price: e.target.value };
                              setConfig({
                                ...config,
                                billing: {
                                  ...config.billing,
                                  packages: nextPkgs,
                                },
                              });
                            }}
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-500 font-semibold">
                          وصف الباقة
                        </label>
                        <input
                          type="text"
                          value={pkg.desc}
                          onChange={(e) => {
                            const nextPkgs = [...config.billing.packages];
                            nextPkgs[idx] = { ...pkg, desc: e.target.value };
                            setConfig({
                              ...config,
                              billing: {
                                ...config.billing,
                                packages: nextPkgs,
                              },
                            });
                          }}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              SECTION 6: سجل المهام والعمليات الحية (LIVE JOBS & ACTIVITY LOG)
             ===================================================================== */}
          {activeSection === 'jobs_log' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    سجل المهام والعمليات الحية (/api/jobs)
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    متابعة جميع طلبات تعديل الصور واستبدال النصوص والنماذج المستخدمة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={jobSearchQuery}
                      onChange={(e) => setJobSearchQuery(e.target.value)}
                      placeholder="ابحث بالنموذج أو النص..."
                      className="h-9 pr-9 pl-3 rounded-lg border border-slate-200 bg-white text-xs focus:border-[#8B7CF6] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchServerAdminState()}
                    className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تحديث</span>
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-10 rounded-lg bg-slate-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredJobs.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">معرّف المهمة</th>
                          <th className="py-3 px-4">النموذج المستخدم</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-4">التكلفة</th>
                          <th className="py-3 px-4">الأمر المنفّذ (Prompt)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredJobs.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                              {job.id}
                            </td>
                            <td
                              dir="ltr"
                              className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap text-right"
                            >
                              {job.model}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap font-bold">
                              <span
                                className={
                                  job.status === 'completed'
                                    ? 'text-emerald-700'
                                    : job.status === 'failed'
                                    ? 'text-rose-700'
                                    : 'text-amber-700'
                                }
                              >
                                {job.status === 'completed'
                                  ? 'مكتمل'
                                  : job.status === 'failed'
                                  ? 'فشل'
                                  : 'قيد المعالجة'}
                              </span>
                            </td>
                            <td className="py-3 px-4 tabular-nums font-bold text-slate-800 whitespace-nowrap">
                              {job.cost} رصيد
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-md truncate font-mono">
                              {job.prompt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                  <Sparkles className="w-7 h-7 text-[#8B7CF6] mx-auto opacity-80" />
                  <div className="text-sm font-bold text-slate-900">
                    لا توجد مهام مسجلة في هذه الجلسة بعد
                  </div>
                  <p className="text-xs text-slate-500">
                    بمجرد قيام المستخدم بتعديل نص داخل أي صورة في الاستوديو، ستظهر تفاصيل المهمة والنموذج المستخدم هنا.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex h-9 px-4 rounded-xl bg-[#8B7CF6] text-white text-xs font-bold items-center gap-1.5"
                  >
                    <span>فتح الاستوديو وتجربة التعديل</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* =====================================================================
              SECTION 7: إعدادات الموقع والهوية العامة (GENERAL SITE & BRANDING)
             ===================================================================== */}
          {activeSection === 'general_branding' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  إعدادات الموقع والهوية العامة
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  تخصيص اسم المنصة، الوصف، اللون الأساسي، وحقوق الفوتر
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      اسم الموقع (يظهر في القائمة الجانبية والهيدر):
                    </label>
                    <input
                      type="text"
                      value={config.general.siteTitle}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          general: {
                            ...config.general,
                            siteTitle: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      الوصف الفرعي للمنصة:
                    </label>
                    <input
                      type="text"
                      value={config.general.siteSubtitle}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          general: {
                            ...config.general,
                            siteSubtitle: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      نص الفوتر (حقوق الملكية):
                    </label>
                    <input
                      type="text"
                      value={config.general.footerText}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          general: {
                            ...config.general,
                            footerText: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      اللون الأساسي للمنصة:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.general.primaryColor}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            general: {
                              ...config.general,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        dir="ltr"
                        value={config.general.primaryColor}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            general: {
                              ...config.general,
                              primaryColor: e.target.value,
                            },
                          })
                        }
                        className="flex-1 h-10 px-3 rounded-xl border border-slate-200 font-mono text-xs font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
