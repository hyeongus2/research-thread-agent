import json
import queue
import threading

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.schemas import LearningPathRequest
from services import historical_thread_service
from services.database_service import delete_lp_history_item, get_lp_history
from utils.database import get_db

router = APIRouter()


@router.post("/learning-path")
def learning_path(body: LearningPathRequest, db: Session = Depends(get_db)):
    return historical_thread_service.build_learning_path(
        topic=body.topic, db=db, lang=body.lang,
        papers_per_era=body.papers_per_era,
        models_count=body.models_count, repos_count=body.repos_count,
    )


@router.post("/learning-path/stream")
def learning_path_stream(body: LearningPathRequest, db: Session = Depends(get_db)):
    """SSE endpoint: streams progress events while building the Learning Path,
    then emits the full result as the final event."""
    event_q: queue.Queue = queue.Queue()

    def run() -> None:
        try:
            for event in historical_thread_service.build_learning_path_stream(
                topic=body.topic, db=db, lang=body.lang,
                papers_per_era=body.papers_per_era,
                models_count=body.models_count, repos_count=body.repos_count,
            ):
                event_q.put(event)
        except Exception as exc:
            event_q.put({"type": "error", "msg": str(exc)})
        finally:
            event_q.put(None)  # sentinel

    threading.Thread(target=run, daemon=True).start()

    def generate():
        while True:
            item = event_q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/learning-path/history")
def list_lp_history(db: Session = Depends(get_db)):
    return get_lp_history(db)


@router.delete("/learning-path/history/{topic}")
def delete_lp_history(topic: str, db: Session = Depends(get_db)):
    ok = delete_lp_history_item(db, topic)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}
