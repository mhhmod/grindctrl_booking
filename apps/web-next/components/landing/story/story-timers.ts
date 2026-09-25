/* Timers the story can pause while the tab is hidden and resume where they
   left off, so a beat's script neither races ahead in the background nor
   restarts when the visitor comes back. */

type Entry = {
  fn: () => void;
  /** Milliseconds left when paused, or the delay when armed. */
  left: number;
  due: number;
  repeat: number;
  id: ReturnType<typeof setTimeout> | null;
};

export class PausableTimers {
  private entries = new Set<Entry>();
  private paused = false;

  later(fn: () => void, ms: number): void {
    this.add({ fn, left: ms, due: 0, repeat: 0, id: null });
  }

  every(fn: () => void, ms: number): void {
    this.add({ fn, left: ms, due: 0, repeat: ms, id: null });
  }

  clear(): void {
    this.entries.forEach((entry) => {
      if (entry.id !== null) clearTimeout(entry.id);
    });
    this.entries.clear();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    this.entries.forEach((entry) => {
      if (entry.id !== null) clearTimeout(entry.id);
      entry.id = null;
      entry.left = Math.max(0, entry.due - now);
    });
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.entries.forEach((entry) => this.arm(entry));
  }

  get size(): number {
    return this.entries.size;
  }

  private add(entry: Entry): void {
    this.entries.add(entry);
    if (!this.paused) this.arm(entry);
  }

  private arm(entry: Entry): void {
    entry.due = Date.now() + entry.left;
    entry.id = setTimeout(() => {
      entry.id = null;
      if (entry.repeat) {
        entry.left = entry.repeat;
        this.arm(entry);
      } else {
        this.entries.delete(entry);
      }
      entry.fn();
    }, entry.left);
  }
}
