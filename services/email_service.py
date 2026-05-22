"""Send email digests via Resend."""

import logging
import os

logger = logging.getLogger(__name__)

_FROM_ADDRESS = "Research Thread <onboarding@resend.dev>"


def _config() -> tuple[str, str]:
    return os.getenv("RESEND_API_KEY", ""), os.getenv("USER_EMAIL", "")


def send_digest(notifications: list) -> bool:
    """Send a digest email for new notifications. Returns True on success."""
    api_key, user_email = _config()
    if not api_key or api_key.startswith("re_your"):
        logger.debug("RESEND_API_KEY not configured — skipping email digest")
        return False
    if not user_email:
        logger.debug("USER_EMAIL not configured — skipping email digest")
        return False
    if not notifications:
        return False

    try:
        import resend
        resend.api_key = api_key

        count = len(notifications)
        subject = f"Research digest — {count} new paper{'s' if count != 1 else ''}"

        resend.Emails.send({
            "from": _FROM_ADDRESS,
            "to": [user_email],
            "subject": subject,
            "html": _build_html(notifications),
        })
        logger.info("Email digest sent to %s (%d papers)", user_email, count)
        return True
    except Exception as exc:
        logger.error("Email send failed: %s", exc)
        return False


def _build_html(notifications: list) -> str:
    rows = []
    for n in notifications:
        citation_html = (
            f"<span style='color:#6B6358;font-size:11px;'>▲ {n.citation_count:,}</span>"
            if (n.citation_count or 0) > 0 else ""
        )
        topic_html = (
            f"<span style='background:#F0EBE1;color:#6B6358;padding:2px 8px;"
            f"border-radius:10px;font-size:11px;'>{n.topic}</span>"
            if n.topic else ""
        )
        abstract_html = ""
        if n.content:
            preview = n.content[:280] + ("…" if len(n.content) > 280 else "")
            abstract_html = (
                f"<p style='color:#6B6358;font-size:12px;line-height:1.6;"
                f"margin:8px 0 0;'>{preview}</p>"
            )
        link_html = (
            f"<a href='{n.source_url}' style='color:#C84B31;font-size:12px;"
            f"text-decoration:none;white-space:nowrap;'>Read →</a>"
            if n.source_url else ""
        )
        rows.append(f"""
    <div style='border-bottom:1px solid #E8E2D5;padding:16px 0;'>
      <div style='display:flex;justify-content:space-between;align-items:flex-start;gap:16px;'>
        <div style='flex:1;min-width:0;'>
          <p style='margin:0 0 6px;font-size:14px;font-weight:600;color:#1A1611;line-height:1.4;'>
            {n.title}
          </p>
          <div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;'>
            {topic_html}{citation_html}
          </div>
          {abstract_html}
        </div>
        <div style='flex-shrink:0;padding-top:2px;'>{link_html}</div>
      </div>
    </div>""")

    items = "\n".join(rows)
    return f"""<!DOCTYPE html>
<html>
<head><meta charset='utf-8'><meta name='viewport' content='width=device-width'></head>
<body style='margin:0;padding:0;background:#FAF7F2;'>
  <div style='max-width:600px;margin:0 auto;padding:40px 28px;background:#FAF7F2;font-family:sans-serif;'>
    <p style='font-family:Georgia,serif;font-size:28px;color:#1A1611;font-weight:400;
              font-style:italic;margin:0 0 2px;'>Research Thread</p>
    <p style='font-size:11px;color:#A09680;letter-spacing:0.08em;margin:0 0 32px;
              text-transform:uppercase;'>Daily Digest</p>
    {items}
    <p style='color:#A09680;font-size:11px;margin-top:32px;line-height:1.8;'>
      You received this because email notifications are on.<br>
      To unsubscribe, open Settings → Notifications → Daily Digest → off.
    </p>
  </div>
</body>
</html>"""
