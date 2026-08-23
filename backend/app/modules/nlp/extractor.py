"""
NLP Entity Extractor using spaCy en_core_web_sm.

Extracts named entities from raw investigation text:
- PERSON names
- LOCATION / GPE
- ORG (organisations)
- DATE / TIME
- MONEY
- Custom patterns: phone numbers, vehicle plates, case references

This is an EXTRACTION tool — results must be reviewed by investigators.
All extractions carry a confidence score and source span.
"""
from __future__ import annotations
import re
from typing import List, Dict, Any

# Lazy-load spaCy so the module can be imported without the model
_nlp = None

def _get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            # Fallback: blank model with no NER
            _nlp = spacy.blank("en")
    return _nlp


# ── Custom regex patterns ─────────────────────────────────────────────────────
PHONE_RE   = re.compile(r'\b(?:\+?\d[\d\s\-]{7,14}\d)\b')
VEHICLE_RE = re.compile(r'\b[A-Z]{2}[\s\-]?\d{1,2}[\s\-]?[A-Z]{1,2}[\s\-]?\d{4}\b')
CASE_RE    = re.compile(r'\bCASE[\-\s]?\d{4}[\-\s]?\d+\b', re.IGNORECASE)
EMAIL_RE   = re.compile(r'\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b', re.IGNORECASE)
ACCOUNT_RE = re.compile(r'\b\d{9,18}\b')

# spaCy label → our entity type
SPACY_MAP = {
    "PERSON":   "PERSON",
    "GPE":      "LOCATION",
    "LOC":      "LOCATION",
    "ORG":      "ORGANIZATION",
    "DATE":     "DATE",
    "TIME":     "TIME",
    "MONEY":    "MONEY",
    "CARDINAL": None,   # skip raw numbers
    "FAC":      "LOCATION",
}


def extract_entities(text: str) -> List[Dict[str, Any]]:
    """
    Extract named entities from investigation text.

    Returns a list of entity dicts:
    {
        "text": str,
        "type": str,        # PERSON | LOCATION | ORGANIZATION | VEHICLE | PHONE | ...
        "start": int,
        "end": int,
        "confidence": float,
        "source_text": str, # surrounding context
        "status": "PENDING" # investigator must review
    }
    """
    if not text or not text.strip():
        return []

    nlp = _get_nlp()
    doc = nlp(text[:10_000])  # cap at 10k chars

    results: List[Dict[str, Any]] = []
    seen: set = set()

    def add(ent_text: str, ent_type: str, start: int, end: int, conf: float):
        key = f"{ent_text.lower()}:{ent_type}"
        if key in seen:
            return
        seen.add(key)
        # Extract surrounding context (±40 chars)
        ctx_start = max(0, start - 40)
        ctx_end   = min(len(text), end + 40)
        results.append({
            "text":        ent_text.strip(),
            "type":        ent_type,
            "start":       start,
            "end":         end,
            "confidence":  round(conf, 2),
            "source_text": text[ctx_start:ctx_end].strip(),
            "status":      "PENDING",
        })

    # spaCy NER results
    for ent in doc.ents:
        mapped = SPACY_MAP.get(ent.label_)
        if mapped:
            add(ent.text, mapped, ent.start_char, ent.end_char, 0.82)

    # Custom patterns — higher confidence (deterministic regex)
    for m in PHONE_RE.finditer(text):
        add(m.group(), "PHONE", m.start(), m.end(), 0.90)
    for m in VEHICLE_RE.finditer(text):
        add(m.group(), "VEHICLE", m.start(), m.end(), 0.92)
    for m in CASE_RE.finditer(text):
        add(m.group(), "CASE_REF", m.start(), m.end(), 0.95)
    for m in EMAIL_RE.finditer(text):
        add(m.group(), "EMAIL", m.start(), m.end(), 0.97)

    return sorted(results, key=lambda x: x["start"])


def compute_name_similarity(name_a: str, name_b: str) -> float:
    """
    Simple token-overlap similarity for entity resolution.
    Returns 0.0–1.0.
    """
    if not name_a or not name_b:
        return 0.0
    tokens_a = set(name_a.lower().split())
    tokens_b = set(name_b.lower().split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    union = tokens_a | tokens_b
    jaccard = len(intersection) / len(union)
    # Boost: if one name is contained in the other
    if name_a.lower() in name_b.lower() or name_b.lower() in name_a.lower():
        jaccard = max(jaccard, 0.75)
    return round(jaccard, 3)


def find_possible_duplicates(
    entities: List[Dict],
    threshold: float = 0.65,
) -> List[Dict[str, Any]]:
    """
    Given a list of PERSON entities, detect possible duplicates.
    Returns pairs with similarity scores.
    """
    persons = [e for e in entities if e["type"] == "PERSON"]
    pairs = []
    for i in range(len(persons)):
        for j in range(i + 1, len(persons)):
            sim = compute_name_similarity(persons[i]["text"], persons[j]["text"])
            if sim >= threshold:
                pairs.append({
                    "entity_a": persons[i]["text"],
                    "entity_b": persons[j]["text"],
                    "similarity": sim,
                    "recommendation": "REVIEW" if sim < 0.85 else "LIKELY_SAME",
                    "status": "PENDING",
                })
    return sorted(pairs, key=lambda x: x["similarity"], reverse=True)
