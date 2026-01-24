export interface Config {
  piUrl: string;
  lmStudioUrl: string;
  whisperCommand: string;
  whisperModel: string;
  pollingIntervalSeconds: number;
  processedDir: string;
  tempDir: string;
}

export interface UnprocessedFile {
  filename: string;
  type: 'audio' | 'image';
  size: number;
  timestamp: string;
}

export interface QueueItem {
  id: string;
  file: UnprocessedFile;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface ProcessingResult {
  filename: string;
  type: 'audio' | 'image';
  content: string;
  timestamp: string;
  processingTime: number;
}

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  totalProcessed: number;
}
