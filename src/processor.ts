import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { Config, ProcessingResult } from './types';

const execAsync = promisify(exec);

export class Processor {
  constructor(private config: Config) {}

  async processAudio(filename: string, filePath: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    console.log(`[PROCESSOR] Transcribing audio: ${filename}`);

    try {
      const outputDir = path.dirname(filePath);
      const baseName = path.basename(filePath, path.extname(filePath));
      const outputFile = path.join(outputDir, `${baseName}.txt`);

      const command = `"${this.config.whisperCommand}" -m "${this.config.whisperModel}" -f "${filePath}" -otxt -of "${path.join(outputDir, baseName)}"`;
      
      console.log(`[PROCESSOR] Running whisper.cpp: ${command}`);
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.log(`[PROCESSOR] Whisper stderr: ${stderr}`);
      }

      let transcription = '';
      try {
        transcription = await fs.readFile(outputFile, 'utf-8');
        transcription = transcription.trim();
      } catch (error) {
        console.error(`[PROCESSOR] Failed to read transcription output: ${error}`);
        throw new Error(`Whisper completed but output file not found: ${outputFile}`);
      }

      const processingTime = Date.now() - startTime;
      console.log(`[PROCESSOR] Transcription complete (${processingTime}ms): ${transcription.substring(0, 100)}...`);

      return {
        filename,
        type: 'audio',
        content: transcription,
        timestamp: new Date().toISOString(),
        processingTime
      };
    } catch (error) {
      console.error(`[PROCESSOR] Audio processing failed:`, error);
      throw error;
    }
  }

  async processImage(filename: string, filePath: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    console.log(`[PROCESSOR] Describing image: ${filename}`);

    try {
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(filename).toLowerCase();
      const mimeType = this.getMimeType(ext);

      const response = await axios.post(
        `${this.config.lmStudioUrl}/v1/chat/completions`,
        {
          model: "default",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Describe this image in detail. Include what you see, any text present, colors, objects, people, and the overall scene or context."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          timeout: 60000
        }
      );

      const description = response.data.choices[0].message.content;
      const processingTime = Date.now() - startTime;
      
      console.log(`[PROCESSOR] Image description complete (${processingTime}ms): ${description.substring(0, 100)}...`);

      return {
        filename,
        type: 'image',
        content: description,
        timestamp: new Date().toISOString(),
        processingTime
      };
    } catch (error) {
      console.error(`[PROCESSOR] Image processing failed:`, error);
      throw error;
    }
  }

  private getMimeType(ext: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }
}
