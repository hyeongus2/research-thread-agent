import json
import queue
import threading

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.schemas import SearchRequest, SummarizeOverviewRequest, SummarizePaperRequest
from config.settings import settings
from services import claude_service, thread_service
from utils.database import get_db

router = APIRouter()


def _attach_code_links(papers: list[dict], db: Session) -> None:
    """Mutate each paper dict in-place, adding a code_links list by arXiv ID."""
    from models.paper_code import PaperCodeLink

    arxiv_ids = [p["arxiv_id"] for p in papers if p.get("arxiv_id")]
    if not arxiv_ids:
        return

    rows = (
        db.query(PaperCodeLink)
        .filter(PaperCodeLink.arxiv_id.in_(arxiv_ids))
        .order_by(PaperCodeLink.is_official.desc(), PaperCodeLink.stars.desc())
        .all()
    )

    links_by_id: dict[str, list] = {}
    for row in rows:
        links_by_id.setdefault(row.arxiv_id, []).append(
            {"repo_url": row.repo_url, "is_official": row.is_official, "stars": row.stars}
        )

    for paper in papers:
        paper["code_links"] = links_by_id.get(paper.get("arxiv_id", ""), [])


@router.post("/search")
def search(body: SearchRequest, db: Session = Depends(get_db)):
    result = thread_service.create_research_thread(
        keyword=body.keyword,
        start_date=body.start_date,
        end_date=body.end_date,
        user_id=body.user_id,
        db=db,
        paper_limit=body.paper_limit,
        model_limit=body.model_limit,
        repo_limit=body.repo_limit,
    )
    _attach_code_links(result.get("papers", []), db)
    return result


@router.post("/search/stream")
def search_stream(body: SearchRequest, db: Session = Depends(get_db)):
    """SSE endpoint: streams source-completion events, then the full result."""
    progress_q: queue.Queue = queue.Queue()
    result_holder: list = [None]
    error_holder: list = [None]

    def on_progress(stage: str, msg: str) -> None:
        progress_q.put({"stage": stage, "msg": msg})

    def run() -> None:
        try:
            result_holder[0] = thread_service.create_research_thread(
                keyword=body.keyword,
                start_date=body.start_date,
                end_date=body.end_date,
                user_id=body.user_id,
                db=db,
                on_progress=on_progress,
                paper_limit=body.paper_limit,
                model_limit=body.model_limit,
                repo_limit=body.repo_limit,
            )
        except Exception as exc:
            error_holder[0] = str(exc)
        finally:
            progress_q.put(None)  # sentinel

    threading.Thread(target=run, daemon=True).start()

    def generate():
        while True:
            item = progress_q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item)}\n\n"
        if result_holder[0] is not None:
            _attach_code_links(result_holder[0].get("papers", []), db)
            yield f"data: {json.dumps({'stage': 'done', 'result': result_holder[0]})}\n\n"
        else:
            yield f"data: {json.dumps({'stage': 'error', 'msg': error_holder[0] or 'Search failed'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/summarize/paper")
def summarize_paper(body: SummarizePaperRequest):
    """Return a one-sentence AI summary for a paper abstract."""
    if not settings.ANTHROPIC_API_KEY:
        return {"summary": None, "no_api_key": True}
    summary = claude_service.summarize_paper(body.abstract, lang=body.lang)
    return {"summary": summary, "no_api_key": False}


@router.post("/summarize/overview")
def summarize_overview(body: SummarizeOverviewRequest):
    """Return an AI overview of the search topic."""
    if not settings.ANTHROPIC_API_KEY:
        return {"overview": None, "no_api_key": True}
    overview = claude_service.generate_overview(body.keyword, body.papers, lang=body.lang)
    return {"overview": overview, "no_api_key": False}


@router.get("/search/history")
def get_search_history(user_id: int, db: Session = Depends(get_db)):
    from models.thread import SearchHistory

    records = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.searched_at.desc())
        .limit(20)
        .all()
    )
    return [
        {"id": r.id, "keyword": r.keyword, "searched_at": str(r.searched_at)}
        for r in records
    ]


@router.delete("/search/history/{item_id}")
def delete_search_history(item_id: int, db: Session = Depends(get_db)):
    from services.database_service import delete_search_history_item
    ok = delete_search_history_item(db, item_id)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}
