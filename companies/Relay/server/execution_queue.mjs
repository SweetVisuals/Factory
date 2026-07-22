import { AsyncLocalStorage } from 'async_hooks';

const queueStorage = new AsyncLocalStorage();

class ExecutionQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  enqueue(fn, name = 'task') {
    const parentContext = queueStorage.getStore();
    if (parentContext) {
      // Already running within a queue task context. Execute immediately to avoid deadlocks.
      return fn();
    }

    return new Promise((resolve, reject) => {
      this.queue = this.queue.then(async () => {
        return queueStorage.run(true, async () => {
          try {
            console.log(`[Queue] Starting execution of task: ${name}`);
            const res = await fn();
            console.log(`[Queue] Completed task: ${name}`);
            resolve(res);
          } catch (err) {
            console.error(`[Queue] Error in task: ${name}:`, err.message);
            reject(err);
          }
        });
      });
    });
  }
}

export const executionQueue = new ExecutionQueue();
