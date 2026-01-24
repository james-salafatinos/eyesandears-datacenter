# Eyes and Ears - Windows PC Processing Server

Windows PC processing server that polls a Raspberry Pi for unprocessed media files, processes them using whisper.cpp and LM Studio, then stores results and notifies the Pi.

## Features

- **Automatic Polling**: Polls Raspberry Pi every 30 seconds for unprocessed files
- **Audio Transcription**: Uses whisper.cpp for local audio transcription
- **Image Description**: Uses LM Studio vision API for image analysis
- **Processing Queue**: FIFO queue with one-at-a-time processing
- **Auto-cleanup**: Removes files from Pi and local temp after processing
- **Status API**: Monitor queue status and processing history

## Prerequisites

1. **Node.js** (v18 or higher)
2. **whisper.cpp** - Download and build from https://github.com/ggerganov/whisper.cpp
3. **LM Studio** - Running with vision model at http://192.168.1.151:1234
4. **Raspberry Pi** - Running eyesandears3 server

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure whisper.cpp

Download whisper.cpp and a model:

```bash
# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build (Windows)
mkdir build
cd build
cmake ..
cmake --build . --config Release

# Download a model (base.en recommended for speed)
cd ..
bash ./models/download-ggml-model.sh base.en
```

### 3. Configure Application

Edit `config.json`:

```json
{
  "piUrl": "http://192.168.1.152:3000",
  "lmStudioUrl": "http://192.168.1.151:1234",
  "whisperCommand": "C:\\path\\to\\whisper.cpp\\build\\bin\\Release\\main.exe",
  "whisperModel": "C:\\path\\to\\whisper.cpp\\models\\ggml-base.en.bin",
  "pollingIntervalSeconds": 30,
  "processedDir": "./processed",
  "tempDir": "./temp"
}
```

**Important**: Update these paths:
- `piUrl`: Your Raspberry Pi's IP address
- `whisperCommand`: Full path to whisper.cpp main.exe
- `whisperModel`: Full path to your whisper model file

### 4. Setup LM Studio

1. Open LM Studio
2. Load a vision-capable model (e.g., LLaVA, BakLLaVA)
3. Start the local server on port 1234
4. Ensure it's accessible at http://192.168.1.151:1234

## Usage

### Build and Run

```bash
# Build TypeScript
npm run build

# Start server
npm start

# Or build and run in one command
npm run dev
```

### API Endpoints

#### Get Queue Status
```bash
GET http://localhost:3001/api/status
```

Returns current processing status, queue size, and statistics.

#### Get All Results
```bash
GET http://localhost:3001/api/results
```

Returns all processed results (audio transcriptions and image descriptions).

#### Get Specific Result
```bash
GET http://localhost:3001/api/results/:filename
```

Returns processing result for a specific file.

#### Get Processing History
```bash
GET http://localhost:3001/api/history
```

Returns completed and failed processing jobs.

## How It Works

1. **Polling**: Server polls Pi every 30 seconds for unprocessed files
2. **Download**: Downloads files to local temp directory
3. **Queue**: Adds files to FIFO processing queue
4. **Process**: 
   - Audio: Transcribes using whisper.cpp
   - Images: Describes using LM Studio vision API
5. **Save**: Stores results as JSON in `./processed/audio/` or `./processed/images/`
6. **Notify**: Marks file as processed on Pi
7. **Cleanup**: Deletes file from Pi and local temp

## Project Structure

```
eyesandears3-cloud/
├── src/
│   ├── server.ts          # Express server & API
│   ├── poller.ts          # Pi polling service
│   ├── processor.ts       # Audio/image processing
│   ├── queue.ts           # Processing queue
│   └── types.ts           # TypeScript types
├── processed/
│   ├── audio/             # Transcription results (JSON)
│   └── images/            # Image descriptions (JSON)
├── temp/                  # Downloaded files (auto-cleanup)
├── config.json            # Configuration
├── package.json
└── tsconfig.json
```

## Troubleshooting

### Whisper.cpp Not Found
- Verify `whisperCommand` path in config.json
- Ensure whisper.cpp is built correctly
- Test manually: `main.exe -m model.bin -f test.wav`

### LM Studio Connection Failed
- Check LM Studio is running
- Verify server is on port 1234
- Test: `curl http://192.168.1.151:1234/v1/models`
- Ensure vision model is loaded

### Pi Connection Failed
- Verify Pi IP address in config.json
- Ensure Pi server is running
- Test: `curl http://[PI_IP]:3000/api/unprocessed`

### Processing Stuck
- Check logs for errors
- Verify GPU drivers for LM Studio
- Check disk space in temp/processed directories

## Output Format

### Audio Result
```json
{
  "filename": "audio_20240124_120000.wav",
  "type": "audio",
  "content": "Transcribed text here...",
  "timestamp": "2024-01-24T12:00:30.000Z",
  "processingTime": 5432
}
```

### Image Result
```json
{
  "filename": "image_20240124_120000.jpg",
  "type": "images",
  "content": "The image shows a detailed description...",
  "timestamp": "2024-01-24T12:00:45.000Z",
  "processingTime": 3210
}
```

## Notes

- Processing is sequential (one file at a time) to avoid GPU overload
- Temp files are automatically cleaned up after processing
- Results are stored permanently in `./processed/`
- Failed jobs are logged but not retried automatically
- Server runs on port 3001 (Pi uses 3000)
