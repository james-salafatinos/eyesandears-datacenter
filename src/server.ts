import express from 'express';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Config, ProcessingResult } from './types';
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

async function getAllResults(): Promise<ProcessingResult[]> {
  const audioDir = path.join(config.processedDir, 'audio');
  const imageDir = path.join(config.processedDir, 'image');
  const results: ProcessingResult[] = [];

  try {
    const audioFiles = await fs.readdir(audioDir);
    for (const file of audioFiles) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(audioDir, file), 'utf-8');
        results.push(JSON.parse(data));
      }
    }
  } catch (error) { }

  try {
    const imageFiles = await fs.readdir(imageDir);
    for (const file of imageFiles) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(imageDir, file), 'utf-8');
        results.push(JSON.parse(data));
      }
    }
  } catch (error) { }

  results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return results;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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
    const imagePath = path.join(config.processedDir, 'image', `${filename}.json`);
    
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
    const results = await getAllResults();
    results.reverse();
    res.json(results);
  } catch (error) {
    console.error('[SERVER] Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

app.get('/api/timeline', async (req, res) => {
  try {
    const { start, end } = req.query;
    let results = await getAllResults();
    
    if (start) {
      const startDate = new Date(start as string);
      results = results.filter(r => new Date(r.timestamp) >= startDate);
    }
    if (end) {
      const endDate = new Date(end as string);
      results = results.filter(r => new Date(r.timestamp) <= endDate);
    }
    
    const timeline = results.map(r => ({
      ...r,
      mediaUrl: `/api/media/${r.type}/${r.filename}`
    }));
    
    res.json(timeline);
  } catch (error) {
    console.error('[SERVER] Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const results = await getAllResults();
    const searchTerm = q.toLowerCase();
    
    const matches = results.filter(r => 
      r.content.toLowerCase().includes(searchTerm) ||
      r.filename.toLowerCase().includes(searchTerm)
    ).map(r => ({
      ...r,
      mediaUrl: `/api/media/${r.type}/${r.filename}`,
      snippet: getSnippet(r.content, searchTerm)
    }));
    
    res.json(matches);
  } catch (error) {
    console.error('[SERVER] Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

function getSnippet(content: string, searchTerm: string): string {
  const lowerContent = content.toLowerCase();
  const index = lowerContent.indexOf(searchTerm);
  if (index === -1) return content.substring(0, 150) + '...';
  
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + searchTerm.length + 100);
  let snippet = content.substring(start, end);
  
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  
  return snippet;
}

app.get('/api/media/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  
  if (type !== 'audio' && type !== 'image') {
    return res.status(400).json({ error: 'Invalid type' });
  }
  
  const mediaPath = path.join(config.processedDir, 'media', type, filename);
  
  if (!fsSync.existsSync(mediaPath)) {
    return res.status(404).json({ error: 'Media file not found' });
  }
  
  res.sendFile(path.resolve(mediaPath));
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, startTime, endTime, contextType = 'both' } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }
    
    let results = await getAllResults();
    
    if (startTime) {
      const start = new Date(startTime);
      results = results.filter(r => new Date(r.timestamp) >= start);
    }
    if (endTime) {
      const end = new Date(endTime);
      results = results.filter(r => new Date(r.timestamp) <= end);
    }
    
    if (contextType !== 'both') {
      results = results.filter(r => r.type === contextType);
    }
    
    const MAX_CONTEXT_CHARS = 12000;
    const contextParts: string[] = [];
    let totalChars = 0;
    
    for (let i = results.length - 1; i >= 0; i--) {
      const r = results[i];
      const time = new Date(r.timestamp).toLocaleString();
      const typeLabel = r.type === 'audio' ? 'Audio Transcription' : 'Image Description';
      
      let content = r.content;
      if (content.length > 500) {
        content = content.substring(0, 500) + '... [truncated]';
      }
      
      const part = `[${time}] ${typeLabel} (${r.filename}):\n${content}`;
      
      if (totalChars + part.length > MAX_CONTEXT_CHARS && contextParts.length > 0) {
        break;
      }
      
      contextParts.unshift(part);
      totalChars += part.length;
    }
    
    const context = contextParts.join('\n\n---\n\n');
    
    const systemPrompt = `You are a helpful assistant that helps the user recall and understand their captured memories. You have access to transcriptions from audio recordings and descriptions of images captured over time. Use this context to answer the user's questions about what was said, seen, or happened.

CONTEXT FROM CAPTURED MEMORIES:
${context}

---
Answer the user's question based on the above context. If the information isn't in the context, say so. Be specific and reference timestamps when relevant.`;

    const response = await axios.post(
      `${config.lmStudioUrl}/v1/chat/completions`,
      {
        model: "default",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      { timeout: 60000 }
    );

    const reply = response.data.choices[0].message.content;
    
    res.json({
      reply,
      contextItemCount: results.length,
      timeRange: {
        start: results.length > 0 ? results[0].timestamp : null,
        end: results.length > 0 ? results[results.length - 1].timestamp : null
      }
    });
  } catch (error) {
    console.error('[SERVER] Chat error:', error);
    if (axios.isAxiosError(error)) {
      res.status(500).json({ error: `LLM request failed: ${error.message}` });
    } else {
      res.status(500).json({ error: 'Chat failed' });
    }
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

app.get('/api/stats', async (req, res) => {
  try {
    const results = await getAllResults();
    const audioCount = results.filter(r => r.type === 'audio').length;
    const imageCount = results.filter(r => r.type === 'image').length;
    
    let earliestDate = null;
    let latestDate = null;
    if (results.length > 0) {
      earliestDate = results[0].timestamp;
      latestDate = results[results.length - 1].timestamp;
    }
    
    res.json({
      totalItems: results.length,
      audioCount,
      imageCount,
      earliestDate,
      latestDate,
      processingQueue: queue.getStats()
    });
  } catch (error) {
    console.error('[SERVER] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
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
      console.log(`[SERVER] Dashboard: http://localhost:${PORT}`);
      console.log(`[SERVER] API: http://localhost:${PORT}/api/status`);
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
