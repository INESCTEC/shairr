from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import json
import threading

router = APIRouter()
logger = logging.getLogger(__name__)

# Use a dict with timestamps for cleanup
_upload_progress: Dict[str, Dict[str, Any]] = {}
_SESSION_TTL = 3600  # 1 hour TTL for sessions
_session_lock = threading.Lock()  # Thread lock for safety

def _cleanup_stale_sessions():
    """Remove sessions older than TTL"""
    now = datetime.now()
    stale = [
        sid for sid, data in _upload_progress.items()
        if data.get("last_updated") and (now - data["last_updated"]).seconds > _SESSION_TTL
    ]
    for sid in stale:
        with _session_lock:
            if sid in _upload_progress:
                del _upload_progress[sid]
                logger.info(f"Cleaned up stale session: {sid}")

@router.websocket("/ws/upload-progress/{session_id}")
async def websocket_upload_progress(websocket: WebSocket, session_id: str):
    await websocket.accept()
    logger.info(f"WebSocket connected for session {session_id}")
    
    last_progress = None
    last_ping = datetime.now()
    cleanup_counter = 0
    
    try:
        while True:
            # Clean up stale sessions every 30 iterations
            cleanup_counter += 1
            if cleanup_counter % 30 == 0:
                _cleanup_stale_sessions()
            
            # Check for client messages (pings, etc.)
            try:
                client_msg = await asyncio.wait_for(
                    websocket.receive_text(), 
                    timeout=0.1
                )
                if client_msg:
                    try:
                        data = json.loads(client_msg)
                        if data.get("type") == "ping":
                            await websocket.send_json({"type": "pong"})
                            last_ping = datetime.now()
                    except json.JSONDecodeError:
                        pass
            except asyncio.TimeoutError:
                pass
            except WebSocketDisconnect:
                break
            
            # Get progress
            with _session_lock:
                progress = _upload_progress.get(session_id)
            
            if not progress:
                await websocket.send_json({
                    "type": "error", 
                    "message": "Session not found"
                })
                await asyncio.sleep(1)
                await websocket.close(code=1000)
                break
            
            # Send progress if changed
            current_progress = progress.copy()
            # Remove internal fields before sending
            current_progress.pop("last_updated", None)
            
            if current_progress != last_progress:
                await websocket.send_json({
                    "type": "progress", 
                    "data": current_progress
                })
                last_progress = current_progress
            
            # Check if complete
            if progress.get("status") in ["completed", "failed"]:
                await websocket.send_json({
                    "type": progress["status"], 
                    "data": current_progress
                })
                await asyncio.sleep(0.5)
                await websocket.close(code=1000)
                break
            
            await asyncio.sleep(0.2)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error for session {session_id}: {e}", exc_info=True)
        try:
            await websocket.close(code=1011)
        except:
            pass

# ============ Session Management Functions ============

def init_upload_session(session_id: str, total_files: int, user_id: str):
    with _session_lock:
        _upload_progress[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "overall_progress": 0,
            "processed_files": 0,
            "total_files": total_files,
            "current_file": None,
            "current_file_progress": 0,
            "status": "processing",
            "last_updated": datetime.now()
        }

def update_upload_progress(session_id: str, **updates):
    if session_id not in _upload_progress:
        logger.warning(f"Attempted to update non-existent session: {session_id}")
        return False
    
    with _session_lock:
        if session_id in _upload_progress:
            _upload_progress[session_id].update(updates)
            _upload_progress[session_id]["last_updated"] = datetime.now()
            return True
    return False

def complete_upload_session(session_id: str, results: list = None):
    with _session_lock:
        if session_id in _upload_progress:
            _upload_progress[session_id].update({
                "status": "completed",
                "overall_progress": 100,
                "current_file": None,
                "results": results or [],
                "last_updated": datetime.now()
            })

def fail_upload_session(session_id: str, error: str):
    with _session_lock:
        if session_id in _upload_progress:
            _upload_progress[session_id].update({
                "status": "failed",
                "error": error,
                "last_updated": datetime.now()
            })

def get_progress(session_id: str) -> Optional[Dict[str, Any]]:
    with _session_lock:
        data = _upload_progress.get(session_id)
        if data:
            # Return a copy without internal fields
            result = data.copy()
            result.pop("last_updated", None)
            return result
    return None

def cleanup_session(session_id: str):
    """Manually clean up a session"""
    with _session_lock:
        if session_id in _upload_progress:
            del _upload_progress[session_id]
            logger.info(f"Cleaned up session: {session_id}")