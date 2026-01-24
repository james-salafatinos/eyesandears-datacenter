import { QueueItem, UnprocessedFile, QueueStats } from './types';

class ProcessingQueue {
  private queue: QueueItem[] = [];
  private processing: QueueItem | null = null;
  private completed: QueueItem[] = [];
  private failed: QueueItem[] = [];
  private processCallback: ((item: QueueItem) => Promise<void>) | null = null;

  setProcessCallback(callback: (item: QueueItem) => Promise<void>) {
    this.processCallback = callback;
  }

  add(file: UnprocessedFile): QueueItem {
    const existing = this.queue.find(item => 
      item.file.filename === file.filename && item.file.type === file.type
    );
    
    if (existing) {
      console.log(`[QUEUE] File already queued: ${file.type}/${file.filename}`);
      return existing;
    }

    if (this.processing && 
        this.processing.file.filename === file.filename && 
        this.processing.file.type === file.type) {
      console.log(`[QUEUE] File already processing: ${file.type}/${file.filename}`);
      return this.processing;
    }

    const item: QueueItem = {
      id: `${file.type}-${file.filename}-${Date.now()}`,
      file,
      status: 'queued',
      addedAt: new Date()
    };

    this.queue.push(item);
    console.log(`[QUEUE] Added to queue: ${file.type}/${file.filename} (queue size: ${this.queue.length})`);
    
    this.processNext();
    return item;
  }

  private async processNext() {
    if (this.processing || this.queue.length === 0 || !this.processCallback) {
      return;
    }

    const item = this.queue.shift()!;
    this.processing = item;
    item.status = 'processing';
    item.startedAt = new Date();

    console.log(`[QUEUE] Processing: ${item.file.type}/${item.file.filename}`);

    try {
      await this.processCallback(item);
      item.status = 'completed';
      item.completedAt = new Date();
      this.completed.push(item);
      console.log(`[QUEUE] Completed: ${item.file.type}/${item.file.filename}`);
    } catch (error) {
      item.status = 'failed';
      item.completedAt = new Date();
      item.error = error instanceof Error ? error.message : String(error);
      this.failed.push(item);
      console.error(`[QUEUE] Failed: ${item.file.type}/${item.file.filename}`, error);
    } finally {
      this.processing = null;
      this.processNext();
    }
  }

  getStats(): QueueStats {
    return {
      queued: this.queue.length,
      processing: this.processing ? 1 : 0,
      completed: this.completed.length,
      failed: this.failed.length,
      totalProcessed: this.completed.length + this.failed.length
    };
  }

  getQueue(): QueueItem[] {
    return [...this.queue];
  }

  getCurrent(): QueueItem | null {
    return this.processing;
  }

  getCompleted(): QueueItem[] {
    return [...this.completed];
  }

  getFailed(): QueueItem[] {
    return [...this.failed];
  }
}

export const queue = new ProcessingQueue();
