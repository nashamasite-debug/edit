import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_SITE_ADMIN_CONFIG,
  mergeSiteAdminConfig,
  SiteAdminConfig,
} from '@/lib/ai-models-config';
import { getJobStore } from '@/lib/job-store';

const globalForSiteConfig = globalThis as unknown as {
  studioSiteAdminConfig?: SiteAdminConfig;
};

function getServerSiteConfig(): SiteAdminConfig {
  if (!globalForSiteConfig.studioSiteAdminConfig) {
    globalForSiteConfig.studioSiteAdminConfig = DEFAULT_SITE_ADMIN_CONFIG;
  }
  return globalForSiteConfig.studioSiteAdminConfig;
}

function getProviderEnvStatus() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const dashscopeKey = process.env.DASHSCOPE_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  return {
    GEMINI_API_KEY: Boolean(
      geminiKey &&
        geminiKey.trim().length > 5 &&
        geminiKey !== 'MY_GEMINI_API_KEY'
    ),
    OPENAI_API_KEY: Boolean(
      openaiKey &&
        openaiKey.trim().length > 5 &&
        openaiKey !== 'MY_OPENAI_API_KEY'
    ),
    DASHSCOPE_API_KEY: Boolean(
      (dashscopeKey &&
        dashscopeKey.trim().length > 5 &&
        dashscopeKey !== 'MY_DASHSCOPE_API_KEY') ||
        (openrouterKey &&
          openrouterKey.trim().length > 5 &&
          openrouterKey !== 'MY_OPENROUTER_API_KEY')
    ),
    OPENROUTER_API_KEY: Boolean(
      openrouterKey &&
        openrouterKey.trim().length > 5 &&
        openrouterKey !== 'MY_OPENROUTER_API_KEY'
    ),
  };
}

export async function GET() {
  const config = getServerSiteConfig();
  const providerStatus = getProviderEnvStatus();
  const jobStore = getJobStore();
  const recentJobs = Array.from(jobStore.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50)
    .map((j) => ({
      id: j.id,
      status: j.status,
      type: j.type,
      cost: j.cost,
      model: j.model,
      prompt: j.prompt,
      isRetry: j.isRetry,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
    }));

  return NextResponse.json({
    config,
    providerStatus,
    recentJobs,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const incomingConfig = body?.config as Partial<SiteAdminConfig> | undefined;
    const merged = mergeSiteAdminConfig({
      ...incomingConfig,
      updatedAt: new Date().toISOString(),
    });
    globalForSiteConfig.studioSiteAdminConfig = merged;

    return NextResponse.json({
      ok: true,
      config: merged,
      providerStatus: getProviderEnvStatus(),
    });
  } catch (error) {
    console.error('Error updating site admin config:', error);
    return NextResponse.json(
      { error: 'تعذّر حفظ إعدادات لوحة التحكم في الخادم.' },
      { status: 500 }
    );
  }
}
