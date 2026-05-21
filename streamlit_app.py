import streamlit as st
from utils.database import init_db
from utils.database import SessionLocal
from services.database_service import get_or_create_user, get_unread_notifications

st.set_page_config(
    page_title="Research Thread Agent",
    page_icon="🔬",
    layout="wide",
)

# Initialize DB tables on first run
if "db_initialized" not in st.session_state:
    init_db()
    st.session_state["db_initialized"] = True

# Default user for local single-user mode
DEFAULT_USERNAME = "local_user"

if "user_id" not in st.session_state:
    db = SessionLocal()
    try:
        user = get_or_create_user(db, DEFAULT_USERNAME)
        st.session_state["user_id"] = user.id
    finally:
        db.close()

# Sidebar: unread notification badge
db = SessionLocal()
try:
    unread = get_unread_notifications(db, st.session_state["user_id"])
    unread_count = len(unread)
finally:
    db.close()

with st.sidebar:
    st.title("Research Thread Agent")
    st.caption("AI/ML research curation, local-first")
    st.divider()
    if unread_count > 0:
        st.info(f"🔔 {unread_count} unread notification{'s' if unread_count > 1 else ''}")

# Home page content
st.title("Research Thread Agent")
st.markdown(
    "Collect and curate the latest AI/ML research from **arXiv**, "
    "**Hugging Face Hub**, and **GitHub** — all stored locally."
)

col1, col2, col3 = st.columns(3)
with col1:
    st.markdown("### Quick Search")
    st.markdown("Search for the latest papers, models, and repos by keyword and date range.")
    st.page_link("pages/01_Quick_Search.py", label="Go to Quick Search", icon="🔍")

with col2:
    st.markdown("### Learning Path")
    st.markdown("Explore the historical development of a research topic, era by era.")
    st.page_link("pages/02_Learning_Path.py", label="Go to Learning Path", icon="📚")

with col3:
    st.markdown("### Subscriptions")
    st.markdown("Subscribe to topics and get notified when new content is published.")
    st.page_link("pages/03_Subscriptions.py", label="Go to Subscriptions", icon="🔔")
