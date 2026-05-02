type HandoffMode = 'workflow' | 'voice' | 'file';
type HandoffPriority = 'low' | 'medium' | 'high';
type FlatEntity = string | number | boolean | null;

const MAX_SUMMARY_LENGTH = 400;
const MAX_RECOMMENDED_ACTION_LENGTH = 240;
const MAX_ENTITY_STRING_LENGTH = 220;
const EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000;
const UNSAFE_ENTITY_KEY_PATTERN = /(transcript|raw|blob|binary|base64|file_bytes|file_content)/i;

export const LANDING_PREVIEW_STORAGE_KEY = 'gc:landing:last-preview:v1';

export interface SavedLandingPreview {
  source: 'landing_sandbox';
  mode: HandoffMode;
  workflowSlug: string;
  summary: string;
  confidence: number;
  extractedEntities: Record<string, FlatEntity>;
  decision: {
    route: string;
    priority: HandoffPriority;
    handoffRequired: boolean;
  };
  recommendedAction: string;
  createdAt: string;
}

type SaveLandingPreviewInput = Omit<SavedLandingPreview, 'createdAt'> & {
  createdAt?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFlatEntity(value: unknown): value is FlatEntity {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isValidPriority(value: unknown): value is HandoffPriority {
  return value === 'low' || value === 'medium' || value === 'high';
}

function sanitizeEntityValue(value: FlatEntity): FlatEntity {
  return typeof value === 'string' ? cleanText(value, MAX_ENTITY_STRING_LENGTH) : value;
}

function sanitizeEntities(value: unknown): Record<string, FlatEntity> {
  if (!isObjectRecord(value)) return {};

  return Object.entries(value).reduce<Record<string, FlatEntity>>((acc, [key, entry]) => {
    if (!key.trim() || UNSAFE_ENTITY_KEY_PATTERN.test(key)) return acc;
    if (!isFlatEntity(entry)) return acc;

    const sanitized = sanitizeEntityValue(entry);
    if (typeof sanitized === 'string' && !sanitized) return acc;
    acc[key] = sanitized;
    return acc;
  }, {});
}

function sanitizeInput(input: SaveLandingPreviewInput): SavedLandingPreview {
  return {
    source: 'landing_sandbox',
    mode: input.mode,
    workflowSlug: cleanText(input.workflowSlug, 120),
    summary: cleanText(input.summary, MAX_SUMMARY_LENGTH),
    confidence: Number.isFinite(input.confidence)
      ? Math.max(0, Math.min(Math.round(input.confidence), 100))
      : 0,
    extractedEntities: sanitizeEntities(input.extractedEntities),
    decision: {
      route: cleanText(input.decision?.route, 120),
      priority: input.decision?.priority,
      handoffRequired: Boolean(input.decision?.handoffRequired),
    },
    recommendedAction: cleanText(input.recommendedAction, MAX_RECOMMENDED_ACTION_LENGTH),
    createdAt: cleanText(input.createdAt || new Date().toISOString(), 64),
  };
}

function isExpired(value: SavedLandingPreview) {
  const createdAtMs = Date.parse(value.createdAt);
  return Number.isNaN(createdAtMs) || Date.now() - createdAtMs > EXPIRES_AFTER_MS;
}

function safeGetItem(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write errors (privacy mode / unavailable storage).
  }
}

function safeRemoveItem(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage remove errors (privacy mode / unavailable storage).
  }
}

export function isValidLandingPreviewHandoff(value: unknown): value is SavedLandingPreview {
  if (!isObjectRecord(value)) return false;
  if (value.source !== 'landing_sandbox') return false;
  if (value.mode !== 'workflow' && value.mode !== 'voice' && value.mode !== 'file') return false;
  if (typeof value.workflowSlug !== 'string' || !value.workflowSlug.trim()) return false;
  if (typeof value.summary !== 'string' || !value.summary.trim()) return false;
  if (typeof value.recommendedAction !== 'string' || !value.recommendedAction.trim()) return false;
  if (!Number.isFinite(value.confidence)) return false;
  if (!isObjectRecord(value.extractedEntities)) return false;

  if (!isObjectRecord(value.decision)) return false;
  if (typeof value.decision.route !== 'string' || !value.decision.route.trim()) return false;
  if (!isValidPriority(value.decision.priority)) return false;
  if (typeof value.decision.handoffRequired !== 'boolean') return false;

  if (typeof value.createdAt !== 'string' || !value.createdAt.trim()) return false;
  if (Number.isNaN(Date.parse(value.createdAt))) return false;

  for (const entityValue of Object.values(value.extractedEntities)) {
    if (!isFlatEntity(entityValue)) return false;
  }

  return true;
}

export function saveLandingPreviewHandoff(input: SaveLandingPreviewInput): void {
  if (typeof window === 'undefined') return;

  const sanitized = sanitizeInput(input);
  if (!isValidLandingPreviewHandoff(sanitized)) return;

  safeSetItem(LANDING_PREVIEW_STORAGE_KEY, JSON.stringify(sanitized));
}

export function readLandingPreviewHandoff(): SavedLandingPreview | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = safeGetItem(LANDING_PREVIEW_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isValidLandingPreviewHandoff(parsed) || isExpired(parsed)) {
      clearLandingPreviewHandoff();
      return null;
    }

    return parsed;
  } catch {
    clearLandingPreviewHandoff();
    return null;
  }
}

export function clearLandingPreviewHandoff(): void {
  safeRemoveItem(LANDING_PREVIEW_STORAGE_KEY);
}
