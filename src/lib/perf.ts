import { performance } from 'perf_hooks';

let perfMarkCount = 0;
export function getPerfStart(): string {
  const perfName = `perfMark${perfMarkCount++}`;
  performance.mark(perfName);
  return perfName;
}

export function getPerfDurationHumanReadable(perfName: string): string {
  return printDuration(getPerfDurationMs(perfName));
}

export function getPerfDurationMs(perfName: string): number {
  performance.measure(perfName, perfName);
  return Math.ceil(performance.getEntriesByName(perfName)[1].duration);
}

export function printDuration(durationMs: number): string {
  if (durationMs < 5000) {
    return `${durationMs.toFixed(2)}ms`;
  }
  // round up seconds
  const durationTotalS = Math.ceil(durationMs / 1000);
  if (durationTotalS < 60) {
    return `${durationTotalS}s`;
  }
  const durationM = Math.floor((0 + durationTotalS) / 60);
  const durationS = (0 + durationTotalS) % 60;
  return `${durationM}m ${durationS}s`;
}
