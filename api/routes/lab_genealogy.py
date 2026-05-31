from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.schemas import LabGenealogyRequest
from utils.database import get_db

router = APIRouter()


@router.get("/lab-genealogy/author-search")
def author_search(q: str = Query(..., min_length=2)):
    from services.lab_genealogy_service import search_author_candidates
    return {"candidates": search_author_candidates(q)}


@router.post("/lab-genealogy")
def get_lab_genealogy(body: LabGenealogyRequest, db: Session = Depends(get_db)):
    from services.lab_genealogy_service import build_lab_genealogy
    return build_lab_genealogy(
        root_author_name=body.root_author_name,
        max_depth=body.max_depth,
        lang=body.lang,
        db=db,
    )
