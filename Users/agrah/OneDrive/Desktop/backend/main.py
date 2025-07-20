from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import requests
import time
import json
import logging
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import urllib.parse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Qwen Video Generation API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["http://localhost:8080"] for more security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - exact credentials as provided
BASE_URL = "https://chat.qwen.ai"
CHAT_ID = "c2f7efe1-8c15-4537-b13b-fd021b94ed11"
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjliY2VhNTAwLWY1Y2ItNDIxNi04NWIzLWY5OGNkNTgyZDc4ZSIsImxhc3RfcGFzc3dvcmRfY2hhbmdlIjoxNzUwNjYwODczLCJleHAiOjE3NTM2OTgxMDF9.x8r_jKZBzayyqeY1RRvnRo1KUWBNmZB099Vg26_uvBk"

# Headers setup
headers = {
    "authorization": AUTH_TOKEN,
    "content-type": "application/json",
    "origin": BASE_URL,
    "referer": f"{BASE_URL}/c/{CHAT_ID}",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    "x-request-id": "c584f184-026c-4094-ab24-3b47debe3f7f"
}

# Pydantic models
class VideoGenerationRequest(BaseModel):
    prompt: str
    size: str = "16:9"
    max_attempts: int = 500
    poll_interval: int = 5

class VideoGenerationResponse(BaseModel):
    success: bool
    message: str
    task_id: Optional[str] = None
    video_url: Optional[str] = None
    data: Optional[dict] = None

def log_debug(message):
    """Helper function for debug logging"""
    logger.info(f"[DEBUG] {message}")

def make_video_generation_request(prompt: str, size: str = "16:9"):
    """Make the initial video generation request"""
    # Create payload with the provided prompt
    payload = {
        "stream": False,
        "incremental_output": True,
        "chat_id": CHAT_ID,
        "chat_mode": "normal",
        "model": "qwen3-235b-a22b",
        "parent_id": None,
        "messages": [{
            "fid": "717a9e7d-dc23-431e-8723-7cc87ec60f86",
            "parentId": None,
            "childrenIds": ["f3da5f2c-51af-4f80-a3b9-efcce26e8f52"],
            "role": "user",
            "content": prompt,
            "user_action": "recommendation",
            "files": [],
            "timestamp": int(time.time()),
            "models": ["qwen3-235b-a22b"],
            "chat_type": "t2v",
            "feature_config": {
                "thinking_enabled": False,
                "output_schema": "phase"
            },
            "extra": {
                "meta": {
                    "subChatType": "t2v"
                }
            },
            "sub_chat_type": "t2v",
            "parent_id": None
        }],
        "timestamp": int(time.time()),
        "size": size
    }
    
    url = f"{BASE_URL}/api/v2/chat/completions?chat_id={CHAT_ID}"
    
    log_debug(f"Making video generation request to: {url}")
    log_debug(f"Request payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        log_debug(f"Request failed: {str(e)}")
        return None

def poll_task_status(task_id: str, max_attempts: int = 500, interval: int = 5):
    """Poll the task status until completion or max attempts reached"""
    status_url = f"{BASE_URL}/api/v1/tasks/status/{task_id}"
    
    for attempt in range(1, max_attempts + 1):
        log_debug(f"🔄 Polling attempt {attempt}/{max_attempts} - Task ID: {task_id}")
        
        try:
            response = requests.get(status_url, headers=headers)
            response.raise_for_status()
            status_data = response.json()
            
            log_debug(f"📥 Status response: {json.dumps(status_data, indent=2)}")
            
            # Check for completion with proper video URL extraction
            if status_data.get('success') or status_data.get('task_status') in ['completed', 'success']:
                # Try multiple possible locations for video URL
                video_url = (
                    status_data.get('content') or  # Primary location based on your response
                    status_data.get('data', {}).get('video_url') or  # Alternative location
                    status_data.get('video_url')  # Direct field
                )
                if video_url:
                    print(f"✅ Video generation completed! 🎥 URL: {video_url}")
                    return status_data
                else:
                    print("⚠️ No video URL found in response. Full response:")
                    print(json.dumps(status_data, indent=2))
                    return status_data  # Return data anyway, let the endpoint handle the error
                    
            elif status_data.get('task_status') in ['failed', 'error']:
                log_debug(f"❌ Video generation failed: {status_data.get('message', 'Unknown error')}")
                return None
            
            log_debug(f"⏳ Video generation in progress... (Status: {status_data.get('task_status')})")
            if attempt < max_attempts:
                time.sleep(interval)
                
        except requests.exceptions.RequestException as e:
            log_debug(f"🚨 Polling request failed: {str(e)}")
            time.sleep(interval)
    
    log_debug(f"⏰ Max polling attempts ({max_attempts}) reached without completion")
    return None

@app.post("/generate-video", response_model=VideoGenerationResponse)
async def generate_video(request: VideoGenerationRequest):
    """
    Generate a video from text prompt using Qwen API
    """
    try:
        # Step 1: Initiate video generation
        log_debug("🚀 Starting Qwen video generation process")
        log_debug(f"📝 Received prompt: {request.prompt}")
        
        init_response = make_video_generation_request(request.prompt, request.size)
        
        if not init_response:
            log_debug("❌ Failed to initiate video generation")
            raise HTTPException(status_code=500, detail="Failed to initiate video generation")
        
        log_debug(f"✅ Initial response: {json.dumps(init_response, indent=2)}")
        
        # Step 2: Extract task ID
        try:
            task_id = init_response['data']['messages'][0]['extra']['wanx']['task_id']
            log_debug(f"🆔 Extracted task ID: {task_id}")
        except KeyError as e:
            log_debug(f"❌ Failed to extract task ID: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to extract task ID: {str(e)}")
        
        # Step 3: Poll for completion
        final_result = poll_task_status(task_id, request.max_attempts, request.poll_interval)
        
        if final_result:
            log_debug("📊 Video generation result:")
            log_debug(json.dumps(final_result, indent=2))
            
            # Extract video URL based on actual API response structure
            video_url = (
                final_result.get('content') or  # Primary location based on your response
                final_result.get('data', {}).get('video_url') or  # Alternative location  
                final_result.get('video_url')  # Direct field
            )
            
            if video_url:
                log_debug(f"✅ Video available at: {video_url}")
                return VideoGenerationResponse(
                    success=True,
                    message="Video generation completed successfully",
                    task_id=task_id,
                    video_url=video_url,
                    data=final_result
                )
            else:
                print("⚠️ No video URL found in response. Full response:")
                print(json.dumps(final_result, indent=2))
                raise HTTPException(
                    status_code=500, 
                    detail=f"Video URL not found in response. Full response: {json.dumps(final_result)}"
                )
        else:
            log_debug("❌ Video generation did not complete successfully")
            return VideoGenerationResponse(
                success=False,
                message="Video generation did not complete successfully or timed out",
                task_id=task_id
            )
            
    except HTTPException:
        raise
    except Exception as e:
        log_debug(f"🚨 Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "Qwen Video Generation API", "status": "running"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": int(time.time())}

@app.get("/video-proxy")
def video_proxy(url: str):
    # Validate the URL (optional: only allow Qwen CDN)
    if not url.startswith("https://cdn.qwenlm.ai/"):
        raise HTTPException(status_code=400, detail="Invalid video URL")
    # Stream the video from Qwen to the client
    r = requests.get(url, stream=True)
    return StreamingResponse(r.iter_content(chunk_size=8192), media_type="video/mp4")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")