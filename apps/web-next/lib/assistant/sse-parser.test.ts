import { describe, expect, it } from 'vitest';
import { SseFrameParser } from './sse-parser';

describe('SseFrameParser', () => {
  it('parses a single complete frame fed in one chunk', () => {
    const parser = new SseFrameParser();
    const frames = parser.push('event: token\ndata: {"text":"hi"}\n\n');

    expect(frames).toEqual([{ event: 'token', data: { text: 'hi' } }]);
  });

  it('parses multiple frames fed in one chunk', () => {
    const parser = new SseFrameParser();
    const frames = parser.push('event: token\ndata: {"text":"a"}\n\nevent: token\ndata: {"text":"b"}\n\n');

    expect(frames).toEqual([
      { event: 'token', data: { text: 'a' } },
      { event: 'token', data: { text: 'b' } },
    ]);
  });

  it('buffers a frame split across multiple chunks and only emits once complete', () => {
    const parser = new SseFrameParser();
    const first = parser.push('event: token\ndata: {"te');
    expect(first).toEqual([]);

    const second = parser.push('xt":"hi"}\n\n');
    expect(second).toEqual([{ event: 'token', data: { text: 'hi' } }]);
  });

  it('carries a partial trailing frame forward across pushes', () => {
    const parser = new SseFrameParser();
    parser.push('event: token\ndata: {"text":"a"}\n\nevent: done\ndata: {}\n');
    const rest = parser.push('\n');

    expect(rest).toEqual([{ event: 'done', data: {} }]);
  });
});
