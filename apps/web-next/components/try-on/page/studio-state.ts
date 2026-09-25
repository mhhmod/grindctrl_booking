/* The /try-on studio as plain data: which piece, which photo, which looks,
   and what the look card is doing. Pure functions so the rules (the
   four-look tray, restoring a look, sample photos following their piece)
   are tested without rendering. */

import type { PublicTryOnFailure } from '@/lib/try-on/client';

export type PieceKey = 'abaya' | 'linen' | 'denim' | 'polo';
export type SampleModel = 'woman' | 'man';

export type Piece = {
  key: PieceKey;
  productId: string;
  garment: string;
  model: SampleModel;
  /** A real engine output of this piece on its sample model, made earlier. */
  sampleLook: string;
};

export const PIECE_ORDER: PieceKey[] = ['abaya', 'linen', 'denim', 'polo'];

export const PIECES: Record<PieceKey, Piece> = {
  abaya: {
    key: 'abaya',
    productId: 'demo-embroidered-abaya',
    garment: '/landing/v15/garment-abaya.webp',
    model: 'woman',
    sampleLook: '/landing/v15/woman-abaya.webp',
  },
  linen: {
    key: 'linen',
    productId: 'demo-sage-linen-shirt',
    garment: '/landing/v15/garment-linen-shirt.webp',
    model: 'woman',
    sampleLook: '/landing/v15/woman-linen-shirt.webp',
  },
  denim: {
    key: 'denim',
    productId: 'demo-denim-overshirt',
    garment: '/landing/v15/garment-denim-overshirt.webp',
    model: 'man',
    sampleLook: '/landing/v15/man-denim-overshirt.webp',
  },
  polo: {
    key: 'polo',
    productId: 'demo-knit-polo',
    garment: '/landing/v15/garment-knit-polo.webp',
    model: 'man',
    sampleLook: '/landing/v15/man-knit-polo.webp',
  },
};

export const SAMPLE_PHOTOS: Record<SampleModel, string> = {
  woman: '/landing/v15/shopper-woman.webp',
  man: '/landing/v15/shopper-man.webp',
};

export const MAX_LOOKS = 4;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** What the generate route accepts. types.ts also lists HEIC and HEIF, which the route rejects. */
export const ACCEPTED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type Photo =
  | { kind: 'sample'; model: SampleModel }
  | { kind: 'upload'; dataUrl: string };

export type Look = {
  id: number;
  piece: PieceKey;
  photo: Photo;
  image: string;
  source: 'sample' | 'generated';
};

export type Stage = 'idle' | 'ready' | 'creating' | 'done' | 'failed';

export type StudioState = {
  piece: PieceKey;
  photo: Photo | null;
  stage: Stage;
  /** Chronological, oldest first; the tray shows them newest first. */
  looks: Look[];
  showing: number | null;
  view: 'look' | 'photo';
  failure: PublicTryOnFailure | null;
  fileError: 'size' | 'type' | null;
  /** Bumped whenever an in-flight generation must be ignored. */
  request: number;
  nextId: number;
};

export const INITIAL_STATE: StudioState = {
  piece: 'abaya',
  photo: null,
  stage: 'idle',
  looks: [],
  showing: null,
  view: 'look',
  failure: null,
  fileError: null,
  request: 0,
  nextId: 1,
};

export function photoSrc(photo: Photo): string {
  return photo.kind === 'sample' ? SAMPLE_PHOTOS[photo.model] : photo.dataUrl;
}

export function validateUpload(file: { type: string; size: number }): 'size' | 'type' | null {
  if (!(ACCEPTED_UPLOAD_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MAX_UPLOAD_BYTES) return 'size';
  return null;
}

/** Adds a look, keeping at most four and dropping the oldest. */
export function addLook(state: StudioState, look: Omit<Look, 'id'>): StudioState {
  const entry: Look = { ...look, id: state.nextId };
  const looks = [...state.looks, entry].slice(-MAX_LOOKS);
  return {
    ...state,
    looks,
    showing: entry.id,
    nextId: state.nextId + 1,
    stage: 'done',
    view: 'look',
    failure: null,
  };
}

function sampleLookFor(piece: PieceKey): Omit<Look, 'id'> {
  const p = PIECES[piece];
  return { piece, photo: { kind: 'sample', model: p.model }, image: p.sampleLook, source: 'sample' };
}

/** Shows the stored sample look for a piece, reusing the tray entry when there is one. */
function showSample(state: StudioState, piece: PieceKey): StudioState {
  const existing = state.looks.find(
    (look) => look.piece === piece && look.source === 'sample',
  );
  const base = { ...state, piece, photo: { kind: 'sample', model: PIECES[piece].model } as Photo };
  if (existing) {
    return { ...base, showing: existing.id, stage: 'done', view: 'look', failure: null };
  }
  return addLook(base, sampleLookFor(piece));
}

export type StudioAction =
  | { type: 'pickPiece'; piece: PieceKey }
  | { type: 'useSample' }
  | { type: 'rejectFile'; reason: 'size' | 'type' }
  | { type: 'setUpload'; dataUrl: string }
  | { type: 'clearPhoto' }
  | { type: 'create' }
  | { type: 'generated'; request: number; image: string }
  | { type: 'failed'; request: number; failure: PublicTryOnFailure }
  | { type: 'showLook'; id: number }
  | { type: 'setView'; view: 'look' | 'photo' };

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'pickPiece': {
      /* Any running request belongs to the old piece: ignore its answer. */
      const next = { ...state, request: state.request + 1, fileError: null };
      /* A sample photo follows its piece's model and shows the stored look
         at once; an uploaded photo stays and waits for Create my look. */
      if (state.photo?.kind === 'sample') return showSample(next, action.piece);
      return {
        ...next,
        piece: action.piece,
        stage: state.photo ? 'ready' : 'idle',
        showing: null,
        view: 'look',
        failure: null,
      };
    }
    case 'useSample':
      return {
        ...state,
        photo: { kind: 'sample', model: PIECES[state.piece].model },
        stage: 'ready',
        showing: null,
        view: 'look',
        failure: null,
        fileError: null,
        request: state.request + 1,
      };
    case 'rejectFile':
      return { ...state, fileError: action.reason };
    case 'setUpload':
      return {
        ...state,
        photo: { kind: 'upload', dataUrl: action.dataUrl },
        stage: 'ready',
        showing: null,
        view: 'look',
        failure: null,
        fileError: null,
        request: state.request + 1,
      };
    case 'clearPhoto':
      /* Looks already made stay in the tray. */
      return {
        ...state,
        photo: null,
        stage: 'idle',
        showing: null,
        view: 'look',
        failure: null,
        request: state.request + 1,
      };
    case 'create': {
      if (!state.photo) return state;
      if (state.photo.kind === 'sample') return showSample(state, state.piece);
      return { ...state, stage: 'creating', failure: null, showing: null, view: 'look', request: state.request + 1 };
    }
    case 'generated':
      if (action.request !== state.request || state.stage !== 'creating' || state.photo?.kind !== 'upload') return state;
      return addLook(state, { piece: state.piece, photo: state.photo, image: action.image, source: 'generated' });
    case 'failed':
      if (action.request !== state.request || state.stage !== 'creating') return state;
      return { ...state, stage: 'failed', failure: action.failure };
    case 'showLook': {
      const look = state.looks.find((item) => item.id === action.id);
      if (!look) return state;
      /* Restores the look's piece and photo too, uploads included. */
      return {
        ...state,
        piece: look.piece,
        photo: look.photo,
        showing: look.id,
        stage: 'done',
        view: 'look',
        failure: null,
        fileError: null,
        request: state.request + 1,
      };
    }
    case 'setView':
      return state.stage === 'done' ? { ...state, view: action.view } : state;
    default:
      return state;
  }
}

export function currentLook(state: StudioState): Look | null {
  return state.showing === null ? null : state.looks.find((look) => look.id === state.showing) ?? null;
}

/** The look on screen and the most recent other look, for the compare view. */
export function comparePair(state: StudioState): [Look, Look] | null {
  if (state.looks.length < 2) return null;
  const shown = currentLook(state) ?? state.looks[state.looks.length - 1];
  const other = [...state.looks].reverse().find((look) => look.id !== shown.id);
  return other ? [shown, other] : null;
}

/** Which journey step is current: 2 (photo) until there is one, 3 (create) until a look shows, then all done. */
export function journeyStep(state: StudioState): 2 | 3 | 5 {
  if (!state.photo) return 2;
  if (state.stage === 'done') return 5;
  return 3;
}

/** File name and extension for downloading a look. */
export function downloadName(image: string): string {
  const mime = image.match(/^data:image\/(png|jpeg|jpg|webp)/i)?.[1]?.toLowerCase();
  const fromPath = image.match(/\.(png|jpe?g|webp)(?:\?|$)/i)?.[1]?.toLowerCase();
  const ext = (mime ?? fromPath ?? 'png').replace('jpeg', 'jpg');
  return `grindctrl-look.${ext}`;
}
