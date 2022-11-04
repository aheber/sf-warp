interface PollConfig {
  initialWaitMs?: number;
  timeout?: number;
  actionName: string;
  action(): unknown;
  cancelAction?(): void;
}

const cancelledTimeouts = [];

const MAX_POLL_MS = 3000;
export function pollForResult<T>(pollConfig: PollConfig): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  return new Promise((resolve, reject): void => {
    timeoutId = setTimeout(() => {
      reject('Timeout polling action');
      cancelledTimeouts.push(timeoutId);
    }, pollConfig.timeout || 30000);
    void executePollAction<T>(pollConfig, resolve, reject, timeoutId);
  }).finally(() => clearTimeout(timeoutId)) as Promise<T>;
}

function executePollAction<T>(
  pollConfig: PollConfig,
  resolve: (unknown) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reject: (reason) => any,
  timeoutId: NodeJS.Timeout,
  pollTime?: number
): void {
  if (cancelledTimeouts.includes(timeoutId)) {
    if (pollConfig.cancelAction) {
      pollConfig.cancelAction.call(null);
    }
    return;
  }
  const waitTime = pollTime || pollConfig.initialWaitMs || 1000;
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async function () {
    let output;
    try {
      output = (await pollConfig.action.call(null)) as T;
    } catch (error) {
      reject(error);
      return;
    }
    if (!output) {
      const nextPollMs = Math.min(waitTime * 2, MAX_POLL_MS);
      executePollAction(pollConfig, resolve, reject, timeoutId, nextPollMs);
      return;
    }
    resolve(output);
  }, waitTime);
}
