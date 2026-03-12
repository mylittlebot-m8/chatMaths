import os
import sys
import uuid
import time
import imageio
import subprocess
import numpy as np
import torch
import threading
import dashscope
import base64
import wave
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import librosa

# Add model paths
sys.path.append("/home/ubuntu/index-tts")
sys.path.append("/home/ubuntu/soulx")

# IndexTTS2 disabled to save VRAM as per user request
# from indextts.infer_v2 import IndexTTS2

# FlashHead imports
from flash_head.inference import get_pipeline, get_base_data, get_infer_params, get_audio_embedding, run_pipeline

app = FastAPI()

# Configure DashScope
dashscope.api_key = "sk-ccd0ca2efea94b1dac7f92b6ed0cc947"

# Global states
tts_model = None # Local TTS disabled
video_pipeline = None

def init_models():
    global video_pipeline
    
    print("Loading SoulX-FlashHead...")
    video_pipeline = get_pipeline(
        world_size=1, 
        ckpt_dir="/home/ubuntu/soulx/models/SoulX-FlashHead-1_3B", 
        wav2vec_dir="/home/ubuntu/soulx/models/wav2vec2-base-960h", 
        model_type="lite"
    )
    get_base_data(
        video_pipeline, 
        cond_image_path_or_dir="/home/ubuntu/soulx/examples/ren.png", 
        base_seed=42, 
        use_face_crop=False
    )
    
    # Warm-up sequence (Qwen + FlashHead)
    print("Starting Warm-up (Qwen path)...")
    try:
        # Use a short text for warm-up
        infer_params = get_infer_params()
        # Mocking a short audio array for video pipeline warm-up
        dummy_audio = np.zeros(int(infer_params['sample_rate'] * 1.0), dtype=np.float32)
        audio_embedding = get_audio_embedding(video_pipeline, dummy_audio)
        chunk = audio_embedding[:, :infer_params['frame_num']].contiguous()
        if chunk.shape[1] == infer_params['frame_num']:
            run_pipeline(video_pipeline, chunk)
        print("Warm-up completed successfully")
    except Exception as e:
        print(f"Warm-up failed (non-critical): {e}")

    print("Models ready")

@app.on_event("startup")
async def startup_event():
    threading.Thread(target=init_models).start()

class GenerateRequest(BaseModel):
    text: str

def save_video(frames_list, video_path, audio_path, fps):
    temp_video_path = video_path.replace('.mp4', '_tmp.mp4')
    with imageio.get_writer(temp_video_path, format='mp4', mode='I',
                            fps=fps , codec='h264', ffmpeg_params=['-bf', '0']) as writer:
        for frames in frames_list:
            frames = frames.numpy().astype(np.uint8)
            for i in range(frames.shape[0]):
                frame = frames[i, :, :, :]
                writer.append_data(frame)
    
    # merge video and audio
    cmd = ['ffmpeg', '-i', temp_video_path, '-i', audio_path, '-c:v', 'copy', '-c:a', 'aac', '-shortest', video_path, '-y']
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if os.path.exists(temp_video_path):
        os.remove(temp_video_path)

async def _process_video_gen(audio_path, video_path, req_id, tts_time_ms):
    video_start = time.time()
    infer_params = get_infer_params()
    tgt_fps = infer_params['tgt_fps']
    frame_num = infer_params['frame_num']
    motion_frames_num = infer_params['motion_frames_num']
    slice_len = frame_num - motion_frames_num

    # Qwen audio might be PCM or WAV. Wave header detection:
    is_wav = False
    if os.path.exists(audio_path) and os.path.getsize(audio_path) > 4:
        with open(audio_path, 'rb') as f:
            header = f.read(4)
            if header == b'RIFF':
                is_wav = True

    if is_wav:
        human_speech_array_all, _ = librosa.load(audio_path, sr=infer_params['sample_rate'], mono=True)
    else:
        with open(audio_path, 'rb') as f:
            pcm_data = f.read()
        audio_int16 = np.frombuffer(pcm_data, dtype=np.int16)
        audio_float = audio_int16.astype(np.float32) / 32768.0
        human_speech_array_all = librosa.resample(audio_float, orig_sr=24000, target_sr=infer_params['sample_rate'])
    
    audio_embedding_all = get_audio_embedding(video_pipeline, human_speech_array_all)
    
    # Correct chunking to cover all audio and handle tail
    total_len = audio_embedding_all.shape[1]
    num_chunks = int(np.ceil((total_len - motion_frames_num) / slice_len))
    if num_chunks < 1: num_chunks = 1
    
    # Pad embedding to fit the last chunk
    required_len = motion_frames_num + num_chunks * slice_len
    if required_len > total_len:
        pad_len = required_len - total_len
        # Create padding with the same shape as audio_embedding_all
        padding = torch.zeros_like(audio_embedding_all)
        padding = padding[:, :pad_len, :, :, :]  # Keep shape, truncate time dimension
        audio_embedding_all = torch.cat([audio_embedding_all, padding], dim=1)
        
    audio_embedding_chunks_list = [audio_embedding_all[:, i * slice_len: i * slice_len + frame_num].contiguous() for i in range(num_chunks)]
    
    print(f"[{req_id}] Processing {len(audio_embedding_chunks_list)} chunks (Total embedding frames: {total_len})...")
    generated_list = []
    for i, audio_embedding_chunk in enumerate(audio_embedding_chunks_list):
        video = run_pipeline(video_pipeline, audio_embedding_chunk)
        
        # Avoid frame duplication: skip first motion_frames_num context frames for chunks after the first
        if i == 0:
            generated_list.append(video.cpu())
        else:
            generated_list.append(video[motion_frames_num:].cpu())
            
        if i % 10 == 0:
            print(f"[{req_id}] Progress: {i}/{len(audio_embedding_chunks_list)}")
        
    # Final video frames should match total_len (approximately, due to padding we might have a bit more)
    save_video(generated_list, video_path, audio_path, fps=tgt_fps)
    video_time = (time.time() - video_start) * 1000
    total_time = tts_time_ms + video_time
    
    headers = {
        "X-TTS-Time": str(int(tts_time_ms)),
        "X-Video-Time": str(int(video_time)),
        "X-Total-Server-Time": str(int(total_time)),
        "Access-Control-Expose-Headers": "X-TTS-Time, X-Video-Time, X-Total-Server-Time"
    }
    return video_path, headers

@app.post("/generate")
async def generate_avatar_video(req: GenerateRequest):
    return JSONResponse({"status": "error", "message": "Local TTS is disabled to save VRAM. Use /generate_qwen"}, status_code=400)

@app.post("/generate_qwen")
async def generate_qwen_video(req: GenerateRequest):
    if video_pipeline is None:
        return JSONResponse({"status": "error", "message": "Video model is still loading"}, status_code=503)

    req_id = str(uuid.uuid4())[:12]
    audio_out = f"/tmp/qwen_audio_{req_id}.wav"
    video_out = f"/tmp/qwen_video_{req_id}.mp4"
    
    print(f"[{req_id}] Starting Aliyun Qwen TTS (Nofish) for: {req.text[:20]}...")
    tts_start = time.time()
    
    try:
        responses = dashscope.MultiModalConversation.call(
            model="qwen3-tts-flash",
            api_key=dashscope.api_key,
            text=req.text,
            voice="Nofish", # Updated voice
            stream=True
        )
        
        pcm_buffer = bytearray()
        for chunk in responses:
            if chunk.status_code == 200:
                if hasattr(chunk.output, 'audio') and chunk.output.audio:
                     raw_data = chunk.output.audio['data'] if isinstance(chunk.output.audio, dict) else chunk.output.audio.data
                     if isinstance(raw_data, str):
                         pcm_buffer.extend(base64.b64decode(raw_data))
                     else:
                         pcm_buffer.extend(raw_data)
            else:
                raise Exception(f"Qwen TTS error: {chunk}")
        
        with wave.open(audio_out, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(pcm_buffer)

    except Exception as e:
        print(f"Qwen TTS failed: {e}")
        return JSONResponse({"status": "error", "message": f"Qwen TTS failed: {str(e)}"}, status_code=500)

    tts_time = (time.time() - tts_start) * 1000
    
    video_path, headers = await _process_video_gen(audio_out, video_out, req_id, tts_time)
    return FileResponse(video_path, media_type="video/mp4", filename=f"avatar_qwen_{req_id}.mp4", headers=headers)

@app.get("/health")
async def health():
    if video_pipeline is not None:
        return {"status": "ready"}
    return JSONResponse({"status": "loading"}, status_code=503)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7862)
