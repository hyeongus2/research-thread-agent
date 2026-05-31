"""Wikidata integration for researcher genealogy.

Queries verified doctoral advisor (P184) and doctoral student (P185)
relationships via Wikidata Search API and SPARQL endpoint.
Free, no auth required.
"""

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_WD_SEARCH_URL = "https://www.wikidata.org/w/api.php"
_WD_SPARQL_URL = "https://query.wikidata.org/sparql"
_HEADERS = {
    "User-Agent": "ResearchThreadAgent/1.0 (open-source research tool)",
    "Accept": "application/json",
}

_ACADEMIC_KEYWORDS = {
    "researcher", "scientist", "professor", "academic",
    "computer", "physicist", "biologist", "chemist",
    "mathematician", "engineer", "scholar",
}


def search_wikidata_researcher(name: str) -> Optional[dict]:
    """Search Wikidata for a researcher by name.

    Returns the best-matching result dict with qid, name, description, or None.
    """
    params = {
        "action": "wbsearchentities",
        "search": name,
        "language": "en",
        "type": "item",
        "limit": 7,
        "format": "json",
    }
    try:
        resp = requests.get(_WD_SEARCH_URL, params=params, headers=_HEADERS, timeout=10)
        resp.raise_for_status()
        results = resp.json().get("search", [])
        if not results:
            return None

        # Prefer results with academic-sounding descriptions
        for r in results:
            desc = (r.get("description") or "").lower()
            if any(kw in desc for kw in _ACADEMIC_KEYWORDS):
                return _format_wd_person(r)

        # Fall back to first result
        return _format_wd_person(results[0])

    except Exception as exc:
        logger.error("Wikidata search failed for '%s': %s", name, exc)
        return None


def _format_wd_person(r: dict) -> dict:
    qid = r.get("id", "")
    return {
        "qid": qid,
        "name": r.get("label", ""),
        "description": r.get("description", ""),
        "wikidata_url": f"https://www.wikidata.org/wiki/{qid}",
    }


def get_wikidata_genealogy(qid: str) -> dict:
    """Fetch doctoral advisors, doctoral students, and affiliations for a Wikidata QID.

    Returns:
        {
          "advisors": [{qid, name, description, affiliations, wikidata_url}],
          "students":  [{qid, name, description, affiliations, wikidata_url}],
          "affiliations": [str],   # root person's current employer
        }
    """
    query = f"""
SELECT DISTINCT
  ?advisor ?advisorLabel ?advisorDesc
  ?student ?studentLabel ?studentDesc
  ?advisorEmployer ?advisorEmployerLabel
  ?studentEmployer ?studentEmployerLabel
  ?employer ?employerLabel
WHERE {{
  BIND(wd:{qid} AS ?person)

  OPTIONAL {{
    ?person wdt:P184 ?advisor .
    OPTIONAL {{ ?advisor wdt:P108 ?advisorEmployer . }}
  }}
  OPTIONAL {{
    ?person wdt:P185 ?student .
    OPTIONAL {{ ?student wdt:P108 ?studentEmployer . }}
  }}
  OPTIONAL {{
    ?person wdt:P108 ?employer .
  }}

  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "en,fr,de,ja,zh" .
  }}
}}
LIMIT 200
"""
    try:
        resp = requests.get(
            _WD_SPARQL_URL,
            params={"query": query, "format": "json"},
            headers=_HEADERS,
            timeout=20,
        )
        resp.raise_for_status()
        bindings = resp.json()["results"]["bindings"]

        advisors: dict[str, dict] = {}
        students: dict[str, dict] = {}
        affiliations: list[str] = []

        for b in bindings:
            if "advisor" in b:
                aid = b["advisor"]["value"].split("/")[-1]
                if aid not in advisors:
                    advisors[aid] = {
                        "qid": aid,
                        "name": b.get("advisorLabel", {}).get("value", aid),
                        "description": b.get("advisorDesc", {}).get("value", ""),
                        "affiliations": [],
                        "wikidata_url": b["advisor"]["value"],
                    }
                emp = b.get("advisorEmployerLabel", {}).get("value", "")
                if emp and emp not in advisors[aid]["affiliations"]:
                    advisors[aid]["affiliations"].append(emp)

            if "student" in b:
                sid = b["student"]["value"].split("/")[-1]
                if sid not in students:
                    students[sid] = {
                        "qid": sid,
                        "name": b.get("studentLabel", {}).get("value", sid),
                        "description": b.get("studentDesc", {}).get("value", ""),
                        "affiliations": [],
                        "wikidata_url": b["student"]["value"],
                    }
                emp = b.get("studentEmployerLabel", {}).get("value", "")
                if emp and emp not in students[sid]["affiliations"]:
                    students[sid]["affiliations"].append(emp)

            if "employer" in b:
                emp = b.get("employerLabel", {}).get("value", "")
                if emp and emp not in affiliations:
                    affiliations.append(emp)

        return {
            "advisors": list(advisors.values()),
            "students": list(students.values()),
            "affiliations": affiliations,
        }

    except Exception as exc:
        logger.error("Wikidata genealogy query failed for %s: %s", qid, exc)
        return {"advisors": [], "students": [], "affiliations": []}


def get_wikidata_students(qid: str) -> list[dict]:
    """Fetch only doctoral students for a given QID (lightweight query for depth-2)."""
    query = f"""
SELECT DISTINCT ?student ?studentLabel ?studentDesc ?employer ?employerLabel
WHERE {{
  wd:{qid} wdt:P185 ?student .
  OPTIONAL {{ ?student wdt:P108 ?employer . }}
  SERVICE wikibase:label {{
    bd:serviceParam wikibase:language "en,fr,de,ja,zh" .
  }}
}}
LIMIT 50
"""
    try:
        resp = requests.get(
            _WD_SPARQL_URL,
            params={"query": query, "format": "json"},
            headers=_HEADERS,
            timeout=15,
        )
        resp.raise_for_status()
        bindings = resp.json()["results"]["bindings"]

        students: dict[str, dict] = {}
        for b in bindings:
            if "student" not in b:
                continue
            sid = b["student"]["value"].split("/")[-1]
            if sid not in students:
                students[sid] = {
                    "qid": sid,
                    "name": b.get("studentLabel", {}).get("value", sid),
                    "description": b.get("studentDesc", {}).get("value", ""),
                    "affiliations": [],
                    "wikidata_url": b["student"]["value"],
                }
            emp = b.get("employerLabel", {}).get("value", "")
            if emp and emp not in students[sid]["affiliations"]:
                students[sid]["affiliations"].append(emp)

        return list(students.values())

    except Exception as exc:
        logger.error("Wikidata students query failed for %s: %s", qid, exc)
        return []
