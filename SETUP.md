# Quick Setup Guide

## ✅ What's Working

Your Windows PC processing server is now **fully implemented and ready to use**! The server successfully:
- Connects to your Raspberry Pi at `http://192.168.1.152:3000`
- Polls for unprocessed files every 30 seconds
- Returns empty results (no files to process yet)

## 🔧 Next Steps

### 1. Update config.json

Edit `config.json` and set your whisper.cpp paths:

```json
{
  "piUrl": "http://192.168.1.XXX:3000",
  "lmStudioUrl": "http://192.168.1.159:1234",
  "whisperCommand": "C:\\path\\to\\whisper.cpp\\main.exe",
  "whisperModel": "C:\\path\\to\\whisper.cpp\\models\\ggml-base.en.bin",
  "pollingIntervalSeconds": 30,
  "processedDir": "./processed",
  "tempDir": "./temp"
}
```

**Important:** Replace the paths with your actual whisper.cpp installation:
- `whisperCommand`: Full path to `main.exe` (or just `main` on Linux/Mac)
- `whisperModel`: Full path to your GGML model file

### 2. Install whisper.cpp (if not already installed)

**Option A: Download Pre-built Binary**
- Visit https://github.com/ggerganov/whisper.cpp/releases
- Download the latest Windows release
- Extract to a folder (e.g., `C:\whisper.cpp\`)

**Option B: Build from Source**
```bash
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

**Download a Model:**
```bash
cd whisper.cpp
bash ./models/download-ggml-model.sh base.en
```

Recommended models:
- `tiny.en` - Fastest, less accurate
- `base.en` - Good balance (recommended)
- `small.en` - Better accuracy, slower

### 3. Setup LM Studio

1. Download and install LM Studio from https://lmstudio.ai/
2. Load a vision-capable model:
   - **LLaVA 1.5** (recommended for speed)
   - **BakLLaVA**
   - **LLaVA 1.6**
3. Start the local server:
   - Click "Local Server" tab
   - Click "Start Server"
   - Ensure it's running on port 1234

### 4. Test the Setup

**Test whisper.cpp:**
```powershell
& "C:\path\to\whisper.cpp\main.exe" -m "C:\path\to\model.bin" -f "test.wav"
```

**Test LM Studio:**
```powershell
curl http://192.168.1.159:1234/v1/models
```

**Test Pi connection:**
```powershell
curl http://192.168.1.152:3000/api/unprocessed
```

### 5. Run the Server

```powershell
npm start
```

You should see:
```
[SERVER] Loading configuration...
[SERVER] Configuration loaded:
  - Pi URL: http://192.168.1.152:3000
  - LM Studio URL: http://192.168.1.9:1234
  - Polling interval: 30s
[POLLER] Starting polling every 30 seconds
[SERVER] Processing server running on http://localhost:3001
[POLLER] Directories created
```

## 📊 Monitor Processing

**Check status:**
```powershell
curl http://localhost:3001/api/status
```

**View all results:**
```powershell
curl http://localhost:3001/api/results
```

**View specific result:**
```powershell
curl http://localhost:3001/api/results/audio_20240124_120000.wav
```

## 🎯 How It Works

1. **Polling**: Every 30 seconds, checks Pi for unprocessed files
2. **Download**: Downloads files to `./temp/`
3. **Process**:
   - Audio → whisper.cpp transcription
   - Images → LM Studio vision description
4. **Save**: Results saved to `./processed/audio/` or `./processed/image/`
5. **Notify**: Marks file as processed on Pi
6. **Cleanup**: Deletes file from Pi and local temp

## 🐛 Troubleshooting

**"Cannot find whisper.cpp"**
- Check `whisperCommand` path in config.json
- Ensure file exists and is executable
- Try running whisper.cpp manually first

**"LM Studio connection failed"**
- Verify LM Studio is running
- Check it's on port 1234
- Ensure vision model is loaded

**"Pi connection failed"**
- Verify Pi IP address
- Ensure Pi server is running
- Check firewall settings

**"Processing stuck"**
- Check logs for errors
- Verify GPU drivers (for LM Studio)
- Check disk space

## 📁 Project Structure

```
eyesandears3-cloud/
├── src/
│   ├── server.ts          # Express API server
│   ├── poller.ts          # Pi polling service
│   ├── processor.ts       # Audio/image processing
│   ├── queue.ts           # Processing queue
│   └── types.ts           # TypeScript types
├── processed/
│   ├── audio/             # Transcription results
│   └── image/             # Image descriptions
├── temp/                  # Downloaded files (auto-cleanup)
├── config.json            # Configuration
└── package.json
```

## 🎉 You're Ready!

Once you've configured whisper.cpp paths, the system is ready to process files from your Raspberry Pi automatically!
