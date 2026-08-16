export interface SseFrame {
  event: string;
  data: unknown;
}

/** Stateful parser for our routes' `event: X\ndata: {...}\n\n` SSE format —
 *  fed raw text chunks as they arrive from a fetch ReadableStream, since a
 *  frame can be split across chunk boundaries. */
export class SseFrameParser {
  private buffer = '';

  push(chunk: string): SseFrame[] {
    this.buffer += chunk;
    const frames: SseFrame[] = [];

    let boundary = this.buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawFrame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);

      const eventLine = rawFrame.split('\n').find((line) => line.startsWith('event: '));
      const dataLine = rawFrame.split('\n').find((line) => line.startsWith('data: '));
      if (eventLine && dataLine) {
        frames.push({
          event: eventLine.slice('event: '.length),
          data: JSON.parse(dataLine.slice('data: '.length)),
        });
      }

      boundary = this.buffer.indexOf('\n\n');
    }

    return frames;
  }
}
