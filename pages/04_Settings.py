import os
import sys

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

st.set_page_config(page_title="Settings", page_icon="⚙️", layout="wide")
st.title("Settings")

st.info("Notification preferences — coming in a future update.")

st.divider()

st.subheader("Data Management")
st.caption("All data is stored locally in `data/research_thread.db`.")

col1, col2 = st.columns([2, 3])
with col1:
    if st.button("Reset Database", type="secondary", use_container_width=True):
        st.session_state["confirm_reset"] = True

with col2:
    st.caption("Deletes all search history, subscriptions, and cached learning paths. The app will reinitialize an empty database on next page load.")

if st.session_state.get("confirm_reset"):
    st.warning("This will permanently delete all local data. Are you sure?")
    c1, c2, _ = st.columns([1, 1, 4])
    with c1:
        if st.button("Yes, reset", type="primary"):
            db_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "data",
                "research_thread.db",
            )
            if os.path.exists(db_path):
                os.remove(db_path)
            from utils.database import init_db
            init_db()
            st.session_state.clear()
            st.success("Database reset. Please refresh the page.")
    with c2:
        if st.button("Cancel"):
            st.session_state["confirm_reset"] = False
            st.rerun()

st.divider()
st.caption("To reset via terminal: `python scripts/reset_db.py`")
