import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Config, UnprocessedFile, QueueItem, ProcessingResult } from './types';
import { queue } from './queue';
import { Processor } from './processor';

export class PiPoller {
  private intervalId: NodeJS.Timeout | null = null;
  private processor: Processor;

  constructor(private config: Config) {
    this.processor = new Processor(config);
    this.setupDirectories();
  }

  private async setupDirectories() {
    try {
      await fs.mkdir(this.config.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.config.processedDir, 'audio'), { recursive: true });
      await fs.mkdir(path.join(this.config.processedDir, 'image'), { recursive: true });
      await fs.mkdir(path.join(this.config.processedDir, 'media', 'audio'), { recursive: true });
      await fs.mkdir(path.join(this.config.processedDir, 'media', 'image'), { recursive: true });
      console.log('[POLLER] Directories created');
    } catch (error) {
      console.error('[POLLER] Failed to create directories:', error);
    }
  }

  start() {
    console.log(`[POLLER] Starting polling every ${this.config.pollingIntervalSeconds} seconds`);
    
    queue.setProcessCallback(async (item: QueueItem) => {
      await this.processFile(item);
    });

    this.poll();
    this.intervalId = setInterval(() => {
      this.poll();
    }, this.config.pollingIntervalSeconds * 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[POLLER] Stopped polling');
    }
  }

  private async poll() {
    try {
      const response = await axios.get<{ files: UnprocessedFile[] }>(
        `${this.config.piUrl}/api/unprocessed`,
        { timeout: 5000 }
      );

      const unprocessedFiles = response.data.files;
      
      if (unprocessedFiles.length > 0) {
        console.log(`[POLLER] Found ${unprocessedFiles.length} unprocessed files`);
        
        for (const file of unprocessedFiles) {
          queue.add(file);
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`[POLLER] Failed to poll Pi: ${error.message}`);
      } else {
        console.error('[POLLER] Unexpected error during polling:', error);
      }
    }
  }

  private async processFile(item: QueueItem) {
    const { file } = item;
    let localPath = '';

    try {
      localPath = await this.downloadFile(file);
      
      let result: ProcessingResult;
      if (file.type === 'audio') {
        result = await this.processor.processAudio(file.filename, localPath);
      } else {
        result = await this.processor.processImage(file.filename, localPath);
      }

      await this.saveResult(result);
      
      await this.saveMediaFile(file, localPath);
      
      await this.markProcessed(file);
      
      await this.cleanupPiFile(file);
      
      await this.cleanupLocalFile(localPath);
      
      console.log(`[POLLER] Successfully processed: ${file.type}/${file.filename}`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn(`[POLLER] File not found on Pi (may have been deleted): ${file.type}/${file.filename}`);
        return;
      }
      
      console.error(`[POLLER] Failed to process ${file.type}/${file.filename}:`, error);
      
      if (localPath) {
        await this.cleanupLocalFile(localPath);
      }
      
      throw error;
    }
  }

  private async downloadFile(file: UnprocessedFile): Promise<string> {
    console.log(`[POLLER] Downloading: ${file.type}/${file.filename}`);
    
    const apiPath = file.type === 'image' ? 'images' : 'audio';
    const response = await axios.get(
      `${this.config.piUrl}/api/${apiPath}/files/${file.filename}`,
      { responseType: 'arraybuffer', timeout: 30000 }
    );

    const localPath = path.join(this.config.tempDir, file.filename);
    await fs.writeFile(localPath, response.data);
    
    console.log(`[POLLER] Downloaded to: ${localPath}`);
    return localPath;
  }

  private async saveResult(result: ProcessingResult) {
    const resultPath = path.join(
      this.config.processedDir,
      result.type,
      `${result.filename}.json`
    );

    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
    console.log(`[POLLER] Saved result to: ${resultPath}`);
  }

  private async markProcessed(file: UnprocessedFile) {
    try {
      const apiType = file.type;
      await axios.post(
        `${this.config.piUrl}/api/files/${apiType}/${file.filename}/mark-processed`,
        {},
        { timeout: 5000 }
      );
      console.log(`[POLLER] Marked as processed on Pi: ${file.type}/${file.filename}`);
    } catch (error) {
      console.error(`[POLLER] Failed to mark as processed:`, error);
    }
  }

  private async cleanupPiFile(file: UnprocessedFile) {
    try {
      const apiType = file.type;
      await axios.delete(
        `${this.config.piUrl}/api/files/${apiType}/${file.filename}/cleanup`,
        { timeout: 5000 }
      );
      console.log(`[POLLER] Deleted from Pi: ${file.type}/${file.filename}`);
    } catch (error) {
      console.error(`[POLLER] Failed to delete from Pi:`, error);
    }
  }

  private async saveMediaFile(file: UnprocessedFile, tempPath: string) {
    try {
      const mediaDir = path.join(this.config.processedDir, 'media', file.type);
      const destPath = path.join(mediaDir, file.filename);
      await fs.copyFile(tempPath, destPath);
      console.log(`[POLLER] Saved media file to: ${destPath}`);
    } catch (error) {
      console.error(`[POLLER] Failed to save media file:`, error);
    }
  }

  private async cleanupLocalFile(filePath: string) {
    try {
      await fs.unlink(filePath);
      console.log(`[POLLER] Cleaned up local file: ${filePath}`);
    } catch (error) {
      console.error(`[POLLER] Failed to cleanup local file:`, error);
    }
  }
}
