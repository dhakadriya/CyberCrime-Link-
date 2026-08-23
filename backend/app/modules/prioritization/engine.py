"""
Rule-Based Prioritization Engine
──────────────────────────────────
Scores suspects based on transparent, explainable rules.

SCORING FACTORS (max 100 points):
──────────────────────────────────
1. Previous related cases     (max 35 pts)
   - Same case type: +15 pts each (max 35)
   
2. Case type similarity       (max 20 pts)
   - Matching case type history: +20 pts

3. Relationship strength      (max 20 pts)
   - STRONG relationship: +10 pts
   - MEDIUM relationship: +5 pts
   - WEAK relationship: +2 pts

4. Evidence association       (max 15 pts)
   - Direct evidence link: +15 pts

5. Geographic relevance       (max 10 pts)
   - Same location as case: +10 pts

IMPORTANT:
- Does NOT use race, religion, caste, or protected characteristics
- Every score is deterministic (same data = same score)
- Every score is accompanied by human-readable explanations
- This is an ANALYTICAL AID, not a guilt determination
"""

from datetime import datetime, timezone
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.person import Person, CasePerson
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.relationship import Relationship
from app.models.scoring import SuspectScore
from app.schemas.scoring import SuspectScoreResponse, ScoreBreakdown


class PrioritizationEngine:
    ENGINE_VERSION = "1.0.0-rules"
    
    # Maximum points per category
    MAX_PREVIOUS_CASES = 35.0
    MAX_CASE_TYPE_SIMILARITY = 20.0
    MAX_RELATIONSHIP = 20.0
    MAX_EVIDENCE = 15.0
    MAX_GEOGRAPHIC = 10.0

    def __init__(self, db: AsyncSession):
        self.db = db

    async def score_case(
        self, case_id: str, scored_by: str
    ) -> List[SuspectScoreResponse]:
        """
        Score all SUSPECT-role persons in a case.
        Returns ranked list (highest score first).
        """
        # Get the current case
        case = (await self.db.execute(
            select(Case).where(Case.id == case_id)
        )).scalar_one_or_none()
        if not case:
            return []

        # Get all suspects in this case
        result = await self.db.execute(
            select(CasePerson)
            .where(
                CasePerson.case_id == case_id,
                CasePerson.role == "SUSPECT",
                CasePerson.is_active == True,
            )
        )
        case_persons = result.scalars().all()

        if not case_persons:
            return []

        # Mark previous latest scores as not latest
        old_scores = await self.db.execute(
            select(SuspectScore).where(
                SuspectScore.case_id == case_id,
                SuspectScore.is_latest == True,
            )
        )
        for old in old_scores.scalars().all():
            old.is_latest = False

        scored_list = []
        for cp in case_persons:
            score_record = await self._score_person(case, cp.person_id, scored_by)
            scored_list.append(score_record)

        # Sort by score descending
        scored_list.sort(key=lambda x: x.score, reverse=True)
        return scored_list

    async def _score_person(
        self, case: Case, person_id: str, scored_by: str
    ) -> SuspectScoreResponse:
        """Calculate investigation priority score for one person in a case."""
        
        person = (await self.db.execute(
            select(Person).where(Person.id == person_id)
        )).scalar_one_or_none()
        if not person:
            return self._zero_score(case.id, person_id, scored_by)

        breakdown = {}
        factors = []
        data_sources = {}

        # ── Factor 1: Previous related cases ──────────────────────────────
        prev_cases_result = await self.db.execute(
            select(CasePerson, Case)
            .join(Case, Case.id == CasePerson.case_id)
            .where(
                CasePerson.person_id == person_id,
                CasePerson.case_id != case.id,
                CasePerson.role == "SUSPECT",
            )
        )
        prev_cases = prev_cases_result.all()
        prev_case_count = len(prev_cases)

        similar_type_count = sum(
            1 for _, c in prev_cases if c.case_type == case.case_type
        )
        different_type_count = prev_case_count - similar_type_count

        # Score: 15 pts per same-type previous case (max 35)
        prev_case_score = min(similar_type_count * 15.0 + different_type_count * 5.0, 
                              self.MAX_PREVIOUS_CASES)
        breakdown["previous_cases"] = prev_case_score
        data_sources["previous_cases_count"] = prev_case_count
        data_sources["similar_type_cases"] = similar_type_count

        if similar_type_count > 0:
            factors.append(
                f"{similar_type_count} previous case(s) of similar type ({case.case_type})"
            )
        if different_type_count > 0:
            factors.append(
                f"{different_type_count} previous case(s) of different type"
            )

        # ── Factor 2: Case type similarity ────────────────────────────────
        type_score = 20.0 if similar_type_count > 0 else 0.0
        breakdown["case_type_similarity"] = type_score
        if type_score > 0:
            factors.append(f"History matches current case type: {case.case_type}")

        # ── Factor 3: Relationship strength ───────────────────────────────
        rel_result = await self.db.execute(
            select(Relationship).where(
                Relationship.source_type == "PERSON",
                Relationship.source_id == person_id,
                Relationship.case_id == case.id,
            )
        )
        relationships = rel_result.scalars().all()
        
        rel_score = 0.0
        for rel in relationships:
            if rel.strength == "STRONG":
                rel_score += 10.0
            elif rel.strength == "MEDIUM":
                rel_score += 5.0
            else:
                rel_score += 2.0

        rel_score = min(rel_score, self.MAX_RELATIONSHIP)
        breakdown["relationship_strength"] = rel_score
        data_sources["relationship_count"] = len(relationships)

        if relationships:
            factors.append(
                f"{len(relationships)} relationship(s) recorded in this case"
            )
            strong = sum(1 for r in relationships if r.strength == "STRONG")
            if strong:
                factors.append(f"{strong} strong relationship(s) with case-relevant entities")

        # ── Factor 4: Evidence association ────────────────────────────────
        # Check if any evidence description mentions person name
        # (In a real system, evidence could be explicitly linked to a person)
        evidence_count_result = await self.db.execute(
            select(Evidence).where(
                Evidence.case_id == case.id,
                Evidence.description.ilike(f"%{person.first_name}%") |
                Evidence.description.ilike(f"%{person.last_name}%"),
            )
        )
        linked_evidence = evidence_count_result.scalars().all()
        evidence_score = min(len(linked_evidence) * 15.0, self.MAX_EVIDENCE)
        breakdown["evidence_association"] = evidence_score
        data_sources["evidence_links"] = len(linked_evidence)

        if linked_evidence:
            factors.append(f"Mentioned in {len(linked_evidence)} evidence item(s)")

        # ── Factor 5: Geographic relevance ────────────────────────────────
        # Check if person's address contains the case location keywords
        geo_score = 0.0
        if case.location and person.address:
            case_location_words = set(case.location.lower().split())
            person_location_words = set(person.address.lower().split())
            if case_location_words & person_location_words:
                geo_score = 10.0
                factors.append(f"Geographic overlap with case location")
        breakdown["geographic_relevance"] = geo_score
        data_sources["location_match"] = geo_score > 0

        # ── Final Score ────────────────────────────────────────────────────
        total = sum(breakdown.values())
        # Normalize to 0-100
        max_possible = (self.MAX_PREVIOUS_CASES + self.MAX_CASE_TYPE_SIMILARITY +
                        self.MAX_RELATIONSHIP + self.MAX_EVIDENCE + self.MAX_GEOGRAPHIC)
        normalized = round((total / max_possible) * 100, 2)

        if not factors:
            factors.append("No significant investigative factors identified")

        # Save to DB
        score_record = SuspectScore(
            case_id=case.id,
            person_id=person_id,
            score=normalized,
            score_breakdown=breakdown,
            contributing_factors=factors,
            data_sources=data_sources,
            engine_version=self.ENGINE_VERSION,
            generated_by=scored_by,
            is_latest=True,
        )
        self.db.add(score_record)
        await self.db.commit()
        await self.db.refresh(score_record)

        return SuspectScoreResponse(
            id=score_record.id,
            case_id=case.id,
            person_id=person_id,
            person_name=person.full_name,
            score=normalized,
            score_breakdown=ScoreBreakdown(**breakdown),
            contributing_factors=factors,
            data_sources=data_sources,
            engine_version=self.ENGINE_VERSION,
            generated_at=score_record.generated_at,
            is_latest=True,
        )

    def _zero_score(self, case_id: str, person_id: str, scored_by: str) -> SuspectScoreResponse:
        return SuspectScoreResponse(
            id="",
            case_id=case_id,
            person_id=person_id,
            person_name="Unknown",
            score=0.0,
            score_breakdown=ScoreBreakdown(),
            contributing_factors=["Person record not found"],
            data_sources={},
            engine_version=self.ENGINE_VERSION,
            generated_at=datetime.now(timezone.utc),
            is_latest=True,
        )
