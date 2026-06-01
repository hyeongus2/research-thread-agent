from sqlalchemy import Boolean, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from utils.database import Base


class PaperCodeLink(Base):
    __tablename__ = "paper_code_links"
    __table_args__ = (Index("idx_pcl_arxiv_id", "arxiv_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    arxiv_id: Mapped[str] = mapped_column(String, nullable=False)
    repo_url: Mapped[str] = mapped_column(String, nullable=False)
    is_official: Mapped[bool] = mapped_column(Boolean, default=False)
    stars: Mapped[int] = mapped_column(Integer, default=0)
