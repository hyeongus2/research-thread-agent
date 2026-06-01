from fastapi import APIRouter

from api.schemas import CitationGraphRequest

router = APIRouter()


@router.post("/citation-graph")
def get_citation_graph(body: CitationGraphRequest):
    from services.citation_graph_service import build_citation_graph
    return build_citation_graph(
        query=body.query,
        max_seed_papers=body.max_seed_papers,
        max_depth=body.max_depth,
        min_citations=body.min_citations,
    )
