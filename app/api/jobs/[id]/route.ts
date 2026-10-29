import { NextRequest, NextResponse } from 'next/server';
import { getJobStore } from '@/lib/job-store';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const store = getJobStore();
    const job = store.get(id);

    if (!job) {
      return NextResponse.json(
        { error: 'لم يتم العثور على المهمة المطلوبة.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      type: job.type,
      cost: job.cost,
      model: job.model,
      prompt: job.prompt,
      replacements: job.replacements,
      resultImageUrl: job.resultImageUrl || null,
      errorMessage: job.errorMessage || null,
      isRetry: Boolean(job.isRetry),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('Error in GET /api/jobs/[id]:', error);
    return NextResponse.json(
      { error: 'تعذّر التحقق من حالة المهمة.' },
      { status: 500 }
    );
  }
}
