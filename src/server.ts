import express from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Config } from './types';
import { PiPoller } from './poller';
import { queue } from './queue';

const app = express();
const PORT = 3001;

let config: Config;
let poller: PiPoller;

async function loadConfig(): Promise<Config> {
  const configPath = path.join(__dirname, '..', 'config.json');
  const configData = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(configData);
}

app.use(express.json());

app.get('/api/status', (req, res) => {
  const stats = queue.getStats();
  const current = queue.getCurrent();
  const queuedItems = queue.getQueue();
  
  res.json({
    stats,
    current: current ? {
      filename: current.file.filename,
      type: current.file.type,
      status: current.status,
      startedAt: current.startedAt
    } : null,
    queue: queuedItems.map(item => ({
      filename: item.file.filename,
      type: item.file.type,
      addedAt: item.addedAt
    }))
  });
});

app.get('/api/results/:filename', async (req, res) => {
  const { filename } = req.params;
  
  try {
    const audioPath = path.join(config.processedDir, 'audio', `${filename}.json`);
    const imagePath = path.join(config.processedDir, 'images', `${filename}.json`);
    
    let resultPath: string | null = null;
    
    try {
      await fs.access(audioPath);
      resultPath = audioPath;
    } catch {
      try {
        await fs.access(imagePath);
        resultPath = imagePath;
      } catch {
        return res.status(404).json({ error: 'Result not found' });
      }
    }
    
    const resultData = await fs.readFile(resultPath, 'utf-8');
    res.json(JSON.parse(resultData));
  } catch (error) {
    console.error('[SERVER] Error fetching result:', error);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

app.get('/api/results', async (req, res) => {
  try {
    const audioDir = path.join(config.processedDir, 'audio');
    const imageDir = path.join(config.processedDir, 'image');
    
    const results: any[] = [];
    
    try {
      const audioFiles = await fs.readdir(audioDir);
      for (const file of audioFiles) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(audioDir, file), 'utf-8');
          results.push(JSON.parse(data));
        }
      }
    } catch (error) {
      console.log('[SERVER] No audio results yet');
    }
    
    try {
      const imageFiles = await fs.readdir(imageDir);
      for (const file of imageFiles) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(imageDir, file), 'utf-8');
          results.push(JSON.parse(data));
        }
      }
    } catch (error) {
      console.log('[SERVER] No image results yet');
    }
    
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    res.json(results);
  } catch (error) {
    console.error('[SERVER] Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

app.get('/api/history', (req, res) => {
  const completed = queue.getCompleted();
  const failed = queue.getFailed();
  
  res.json({
    completed: completed.map(item => ({
      filename: item.file.filename,
      type: item.file.type,
      completedAt: item.completedAt,
      processingTime: item.completedAt && item.startedAt 
        ? item.completedAt.getTime() - item.startedAt.getTime()
        : 0
    })),
    failed: failed.map(item => ({
      filename: item.file.filename,
      type: item.file.type,
      error: item.error,
      failedAt: item.completedAt
    }))
  });
});

async function start() {
  try {
    console.log('[SERVER] Loading configuration...');
    config = await loadConfig();
    
    console.log('[SERVER] Configuration loaded:');
    console.log(`  - Pi URL: ${config.piUrl}`);
    console.log(`  - LM Studio URL: ${config.lmStudioUrl}`);
    console.log(`  - Polling interval: ${config.pollingIntervalSeconds}s`);
    
    poller = new PiPoller(config);
    poller.start();
    
    app.listen(PORT, () => {
      console.log(`[SERVER] Processing server running on http://localhost:${PORT}`);
      console.log(`[SERVER] Status API: http://localhost:${PORT}/api/status`);
      console.log(`[SERVER] Results API: http://localhost:${PORT}/api/results`);
    });
  } catch (error) {
    console.error('[SERVER] Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n[SERVER] Shutting down...');
  if (poller) {
    poller.stop();
  }
  process.exit(0);
});

start();
