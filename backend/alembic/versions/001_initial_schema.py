"""Initial CrimeLink schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-08-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Permissions ──────────────────────────────────────────────────────────
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Roles ────────────────────────────────────────────────────────────────
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Role Permissions ─────────────────────────────────────────────────────
    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("permission_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── Users ────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("badge_number", sa.String(50), unique=True),
        sa.Column("department", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("last_login", sa.DateTime(timezone=True)),
        sa.Column("last_login_ip", sa.String(45)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_users_username", "users", ["username"])
    op.create_index("idx_users_email", "users", ["email"])

    # ── User Roles ───────────────────────────────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Cases ────────────────────────────────────────────────────────────────
    op.create_table(
        "cases",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_number", sa.String(50), unique=True, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("case_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("location", sa.String(500)),
        sa.Column("incident_date", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(50), nullable=False, server_default="OPEN"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="MEDIUM"),
        sa.Column("created_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True)),
        sa.Column("archived_at", sa.DateTime(timezone=True)),
    )
    op.create_index("idx_cases_case_number", "cases", ["case_number"])
    op.create_index("idx_cases_status", "cases", ["status"])
    op.create_index("idx_cases_priority", "cases", ["priority"])
    op.create_index("idx_cases_created_by", "cases", ["created_by"])

    # ── Case Assignments ─────────────────────────────────────────────────────
    op.create_table(
        "case_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(100), nullable=False, server_default="ASSIGNED_OFFICER"),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("case_id", "user_id", name="uq_case_user_assignment"),
    )

    # ── Persons ──────────────────────────────────────────────────────────────
    op.create_table(
        "persons",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("first_name", sa.String(255), nullable=False),
        sa.Column("last_name", sa.String(255), nullable=False),
        sa.Column("alias", sa.String(255)),
        sa.Column("date_of_birth", sa.Date()),
        sa.Column("gender", sa.String(20)),
        sa.Column("nationality", sa.String(100)),
        sa.Column("national_id", sa.String(100)),
        sa.Column("address", sa.Text()),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("occupation", sa.String(255)),
        sa.Column("notes", sa.Text()),
        sa.Column("photo_path", sa.String(500)),
        sa.Column("created_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_persons_name", "persons", ["last_name", "first_name"])

    # ── Case Persons ─────────────────────────────────────────────────────────
    op.create_table(
        "case_persons",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("added_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("case_id", "person_id", "role", name="uq_case_person_role"),
    )
    op.create_index("idx_case_persons_case", "case_persons", ["case_id"])
    op.create_index("idx_case_persons_person", "case_persons", ["person_id"])

    # ── Evidence ─────────────────────────────────────────────────────────────
    op.create_table(
        "evidence",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("evidence_number", sa.String(100), nullable=False),
        sa.Column("evidence_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("stored_filename", sa.String(500), unique=True, nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(200), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="ACTIVE"),
        sa.Column("current_custodian", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id")),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_evidence_case", "evidence", ["case_id"])
    op.create_index("idx_evidence_number", "evidence", ["evidence_number"])
    op.create_index("idx_evidence_hash", "evidence", ["sha256_hash"])

    # ── Evidence Custody ─────────────────────────────────────────────────────
    op.create_table(
        "evidence_custody",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("evidence_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("previous_custodian", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id")),
        sa.Column("new_custodian", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id")),
        sa.Column("transferred_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("remarks", sa.Text()),
        sa.Column("sha256_at_transfer", sa.String(64)),
        sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_custody_evidence", "evidence_custody", ["evidence_id"])

    # ── Investigation Events ──────────────────────────────────────────────────
    op.create_table(
        "investigation_events",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("related_person", postgresql.UUID(as_uuid=False), sa.ForeignKey("persons.id")),
        sa.Column("related_evidence", postgresql.UUID(as_uuid=False), sa.ForeignKey("evidence.id")),
        sa.Column("metadata", postgresql.JSONB()),
    )
    op.create_index("idx_events_case", "investigation_events", ["case_id"])
    op.create_index("idx_events_occurred", "investigation_events", ["occurred_at"])

    # ── Relationships ─────────────────────────────────────────────────────────
    op.create_table(
        "relationships",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("relationship_type", sa.String(100), nullable=False),
        sa.Column("strength", sa.String(20), server_default="MEDIUM"),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("cases.id")),
    )
    op.create_index("idx_relationships_source", "relationships", ["source_type", "source_id"])
    op.create_index("idx_relationships_target", "relationships", ["target_type", "target_id"])

    # ── Locations ─────────────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("address", sa.Text()),
        sa.Column("latitude", sa.Numeric(10, 8)),
        sa.Column("longitude", sa.Numeric(11, 8)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Vehicles ──────────────────────────────────────────────────────────────
    op.create_table(
        "vehicles",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("make", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("year", sa.Integer()),
        sa.Column("license_plate", sa.String(50)),
        sa.Column("color", sa.String(50)),
        sa.Column("vin", sa.String(100)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── Suspect Scores ────────────────────────────────────────────────────────
    op.create_table(
        "suspect_scores",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("person_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Numeric(5, 2), nullable=False),
        sa.Column("score_breakdown", postgresql.JSONB(), nullable=False),
        sa.Column("contributing_factors", postgresql.JSONB(), nullable=False),
        sa.Column("data_sources", postgresql.JSONB(), nullable=False),
        sa.Column("engine_version", sa.String(20), nullable=False, server_default="1.0.0-rules"),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("generated_by", postgresql.UUID(as_uuid=False), sa.ForeignKey("users.id")),
        sa.Column("is_latest", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("idx_scores_case", "suspect_scores", ["case_id"])
    op.create_index("idx_scores_person", "suspect_scores", ["person_id"])

    # ── Audit Logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("username", sa.String(50)),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(100)),
        sa.Column("resource_id", sa.String(255)),
        sa.Column("result", sa.String(20), nullable=False, server_default="SUCCESS"),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.Text()),
        sa.Column("details", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_audit_user", "audit_logs", ["user_id"])
    op.create_index("idx_audit_action", "audit_logs", ["action"])
    op.create_index("idx_audit_created", "audit_logs", ["created_at"])
    op.create_index("idx_audit_resource", "audit_logs", ["resource_type", "resource_id"])

    # ── Security Events ───────────────────────────────────────────────────────
    op.create_table(
        "security_events",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False, server_default="MEDIUM"),
        sa.Column("user_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("username", sa.String(50)),
        sa.Column("ip_address", sa.String(45)),
        sa.Column("user_agent", sa.Text()),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("details", postgresql.JSONB()),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_security_type", "security_events", ["event_type"])
    op.create_index("idx_security_severity", "security_events", ["severity"])
    op.create_index("idx_security_created", "security_events", ["created_at"])


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table("security_events")
    op.drop_table("audit_logs")
    op.drop_table("suspect_scores")
    op.drop_table("vehicles")
    op.drop_table("locations")
    op.drop_table("relationships")
    op.drop_table("investigation_events")
    op.drop_table("evidence_custody")
    op.drop_table("evidence")
    op.drop_table("case_persons")
    op.drop_table("persons")
    op.drop_table("case_assignments")
    op.drop_table("cases")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
