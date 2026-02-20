export class TaskQueue {
    private concurrency: number;
    private running: number = 0;
    private queue: Array<() => void> = [];

    constructor(concurrency: number) {
        this.concurrency = concurrency;
    }

    async enqueue<T>(task: () => Promise<T>): Promise<T> {
        if (this.running >= this.concurrency) {
            await new Promise<void>(resolve => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await task();
        } finally {
            this.running--;
            if (this.queue.length > 0) {
                const next = this.queue.shift();
                if (next) next();
            }
        }
    }
}
