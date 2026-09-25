import { describe, expect, it } from 'vitest';
import {
  comparePair,
  currentLook,
  downloadName,
  INITIAL_STATE,
  journeyStep,
  MAX_LOOKS,
  PIECES,
  studioReducer,
  validateUpload,
  type StudioAction,
  type StudioState,
} from './studio-state';

function run(actions: StudioAction[], from: StudioState = INITIAL_STATE): StudioState {
  return actions.reduce(studioReducer, from);
}

describe('try-on studio state', () => {
  it('starts on the photo step with nothing to create', () => {
    expect(INITIAL_STATE.stage).toBe('idle');
    expect(journeyStep(INITIAL_STATE)).toBe(2);
  });

  it('shows the stored sample look at once, with no progress steps', () => {
    const state = run([{ type: 'useSample' }, { type: 'create' }]);
    expect(state.stage).toBe('done');
    expect(currentLook(state)?.image).toBe(PIECES.abaya.sampleLook);
    expect(currentLook(state)?.source).toBe('sample');
    expect(journeyStep(state)).toBe(5);
  });

  it('switches a sample photo to the model of the newly picked piece', () => {
    const state = run([{ type: 'useSample' }, { type: 'create' }, { type: 'pickPiece', piece: 'denim' }]);
    expect(state.photo).toEqual({ kind: 'sample', model: 'man' });
    expect(currentLook(state)?.image).toBe(PIECES.denim.sampleLook);
    expect(state.stage).toBe('done');
  });

  it('keeps an uploaded photo when the piece changes and waits for Create again', () => {
    const state = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }, { type: 'pickPiece', piece: 'polo' }]);
    expect(state.photo).toEqual({ kind: 'upload', dataUrl: 'data:image/png;base64,AAA' });
    expect(state.stage).toBe('ready');
    expect(state.piece).toBe('polo');
  });

  it('runs an upload through creating to a generated look', () => {
    const creating = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }, { type: 'create' }]);
    expect(creating.stage).toBe('creating');
    expect(journeyStep(creating)).toBe(3);
    const done = studioReducer(creating, { type: 'generated', request: creating.request, image: 'data:image/webp;base64,BBB' });
    expect(done.stage).toBe('done');
    expect(currentLook(done)).toMatchObject({ source: 'generated', piece: 'abaya', image: 'data:image/webp;base64,BBB' });
  });

  it('ignores a late answer after the piece changed mid-generation', () => {
    const creating = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }, { type: 'create' }]);
    const moved = studioReducer(creating, { type: 'pickPiece', piece: 'linen' });
    const late = studioReducer(moved, { type: 'generated', request: creating.request, image: 'data:image/png;base64,LATE' });
    expect(late.looks).toHaveLength(0);
    expect(late.stage).toBe('ready');
    const lateFailure = studioReducer(moved, { type: 'failed', request: creating.request, failure: { kind: 'unknown' } });
    expect(lateFailure.stage).toBe('ready');
  });

  it('ignores a late answer after the photo was cleared', () => {
    const creating = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }, { type: 'create' }]);
    const cleared = studioReducer(creating, { type: 'clearPhoto' });
    const late = studioReducer(cleared, { type: 'generated', request: creating.request, image: 'x' });
    expect(late.looks).toHaveLength(0);
    expect(late.stage).toBe('idle');
  });

  it('lands in the failure state and retries with the same photo and piece', () => {
    const creating = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }, { type: 'create' }]);
    const failed = studioReducer(creating, { type: 'failed', request: creating.request, failure: { kind: 'unavailable' } });
    expect(failed.stage).toBe('failed');
    expect(failed.failure).toEqual({ kind: 'unavailable' });
    const retry = studioReducer(failed, { type: 'create' });
    expect(retry.stage).toBe('creating');
    expect(retry.photo).toEqual(failed.photo);
    expect(retry.piece).toBe(failed.piece);
    expect(retry.failure).toBeNull();
  });

  it('keeps at most four looks, dropping the oldest', () => {
    let state = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,AAA' }]);
    for (let i = 0; i < MAX_LOOKS + 2; i += 1) {
      state = studioReducer(state, { type: 'create' });
      state = studioReducer(state, { type: 'generated', request: state.request, image: `look-${i}` });
    }
    expect(state.looks).toHaveLength(MAX_LOOKS);
    expect(state.looks.map((look) => look.image)).toEqual(['look-2', 'look-3', 'look-4', 'look-5']);
    expect(currentLook(state)?.image).toBe('look-5');
  });

  it('restores the piece and the uploaded photo when a look is chosen from the tray', () => {
    let state = run([{ type: 'setUpload', dataUrl: 'data:image/png;base64,ONE' }, { type: 'create' }]);
    state = studioReducer(state, { type: 'generated', request: state.request, image: 'first' });
    const firstId = state.showing!;
    state = run([{ type: 'useSample' }, { type: 'pickPiece', piece: 'polo' }], state);
    expect(state.photo).toEqual({ kind: 'sample', model: 'man' });
    state = studioReducer(state, { type: 'showLook', id: firstId });
    expect(state.piece).toBe('abaya');
    expect(state.photo).toEqual({ kind: 'upload', dataUrl: 'data:image/png;base64,ONE' });
    expect(currentLook(state)?.image).toBe('first');
  });

  it('keeps looks when the photo is cleared', () => {
    const state = run([{ type: 'useSample' }, { type: 'create' }, { type: 'clearPhoto' }]);
    expect(state.looks).toHaveLength(1);
    expect(state.stage).toBe('idle');
  });

  it('compares the look on screen with the most recent other look', () => {
    const state = run([
      { type: 'useSample' },
      { type: 'create' },
      { type: 'pickPiece', piece: 'linen' },
      { type: 'pickPiece', piece: 'denim' },
    ]);
    const pair = comparePair(state);
    expect(pair?.[0].piece).toBe('denim');
    expect(pair?.[1].piece).toBe('linen');
    expect(comparePair(run([{ type: 'useSample' }, { type: 'create' }]))).toBeNull();
  });

  it('only switches between photo and look once a look is shown', () => {
    expect(studioReducer(INITIAL_STATE, { type: 'setView', view: 'photo' }).view).toBe('look');
    const done = run([{ type: 'useSample' }, { type: 'create' }, { type: 'setView', view: 'photo' }]);
    expect(done.view).toBe('photo');
  });

  it('accepts only JPEG, PNG and WebP up to 8 MB', () => {
    expect(validateUpload({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateUpload({ type: 'image/webp', size: 8 * 1024 * 1024 })).toBeNull();
    expect(validateUpload({ type: 'image/png', size: 8 * 1024 * 1024 + 1 })).toBe('size');
    expect(validateUpload({ type: 'image/heic', size: 1000 })).toBe('type');
    expect(validateUpload({ type: 'application/pdf', size: 1000 })).toBe('type');
  });

  it('names downloads by the image type', () => {
    expect(downloadName('data:image/jpeg;base64,AAA')).toBe('grindctrl-look.jpg');
    expect(downloadName('data:image/webp;base64,AAA')).toBe('grindctrl-look.webp');
    expect(downloadName('/landing/v15/woman-abaya.webp')).toBe('grindctrl-look.webp');
    expect(downloadName('/try-on/mock-result.png')).toBe('grindctrl-look.png');
  });
});
