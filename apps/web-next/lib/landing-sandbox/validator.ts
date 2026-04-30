import type { LandingSandboxInput, SandboxMode } from '@/lib/landing-sandbox/types';

const MAX_TEXT_CHARS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/x-m4a']);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const TEXT_TYPES = ['text/', 'application/json', 'application/xml', 'text/csv'];

function cleanText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function readMode(raw: string): SandboxMode | null {
  if (raw === 'workflow' || raw === 'voice' || raw === 'file') {
    return raw;
  }
  return null;
}

function isTextLikeMimeType(mime: string) {
  return TEXT_TYPES.some((entry) => mime.startsWith(entry));
}

function validateFile(file: File | null | undefined, mode: SandboxMode): string | null {
  if (!file) return null;
  if (file.size > MAX_FILE_BYTES) {
    return 'File exceeds 2 MB limit.';
  }

  const mime = (file.type || '').toLowerCase();
  if (!mime) {
    return 'File type is required.';
  }

  if (mode === 'voice') {
    if (!AUDIO_TYPES.has(mime)) return 'Unsupported audio type.';
    return null;
  }

  if (mode === 'file') {
    if (IMAGE_TYPES.has(mime) || isTextLikeMimeType(mime) || mime === 'application/pdf') {
      return null;
    }
    return 'Unsupported file/image type.';
  }

  return 'File uploads are not supported for workflow mode.';
}

export interface ParseInputResult {
  ok: boolean;
  input?: LandingSandboxInput;
  error?: string;
}

export function parseLandingSandboxInput(raw: {
  mode?: string;
  sessionId?: string;
  locale?: string;
  prompt?: string;
  transcript?: string;
  source?: string;
  file?: File | null;
}): ParseInputResult {
  const mode = readMode(String(raw.mode || ''));
  if (!mode) {
    return { ok: false, error: 'Invalid mode.' };
  }

  const locale = String(raw.locale || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
  const source = raw.source && raw.source !== 'landing_sandbox' ? null : 'landing_sandbox';
  if (!source) {
    return { ok: false, error: 'Invalid source.' };
  }

  const prompt = cleanText(String(raw.prompt || ''));
  const transcript = cleanText(String(raw.transcript || ''));
  const file = raw.file ?? null;

  if (prompt.length > MAX_TEXT_CHARS || transcript.length > MAX_TEXT_CHARS) {
    return { ok: false, error: 'Prompt/transcript exceeds 500 character limit.' };
  }

  const fileError = validateFile(file, mode);
  if (fileError) {
    return { ok: false, error: fileError };
  }

  if (mode === 'workflow' && !prompt) {
    return { ok: false, error: 'Workflow mode requires prompt.' };
  }

  if (mode === 'voice' && !transcript && !file) {
    return { ok: false, error: 'Voice mode requires transcript or audio file.' };
  }

  if (mode === 'file' && !file && !prompt) {
    return { ok: false, error: 'File mode requires file upload or prompt context.' };
  }

  return {
    ok: true,
    input: {
      mode,
      sessionId: cleanText(String(raw.sessionId || '')) || undefined,
      locale,
      prompt,
      transcript: transcript || undefined,
      source: 'landing_sandbox',
      file,
    },
  };
}

export function isTextFile(file: File) {
  const mime = (file.type || '').toLowerCase();
  return isTextLikeMimeType(mime);
}
