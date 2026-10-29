export interface TextReplacementSpec {
  id: number;
  label: string;
  position: string;
  oldText: string;
  newText: string;
}

export interface ServerJobRecord {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  type: 'detect' | 'edit' | 'magic_erase' | 'upscale' | 'editable';
  cost: number;
  model: string;
  prompt: string;
  replacements: TextReplacementSpec[];
  resultImageUrl?: string | null;
  errorMessage?: string | null;
  isRetry?: boolean;
  createdAt: number;
  updatedAt: number;
}

declare global {
  var _aiTextStudioJobs: Map<string, ServerJobRecord> | undefined;
}

export function getJobStore(): Map<string, ServerJobRecord> {
  if (!global._aiTextStudioJobs) {
    global._aiTextStudioJobs = new Map<string, ServerJobRecord>();
  }
  return global._aiTextStudioJobs;
}

export function buildEditPrompt(replacements: TextReplacementSpec[]): string {
  const parts = replacements
    .map((r) => `[${r.position}] «${r.oldText}» → «${r.newText}»`)
    .join(', ');
  return `Edit this image. Replace ONLY these texts: ${parts}. Keep fonts, colors, layout, logos, people and everything else pixel-identical. Arabic text must be correctly connected and right-to-left.`;
}
