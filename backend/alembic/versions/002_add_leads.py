"""Add investigative_leads table

Revision ID: 002_add_leads
Revises: 001_initial
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002_add_leads"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investigative_leads",
        sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("lead_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="MEDIUM"),
        sa.Column("subject_type", sa.String(50)),
        sa.Column("subject_id", postgresql.UUID(as_uuid=False)),
        sa.Column("subject_name", sa.String(500)),
        sa.Column("case_id", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("cases.id", ondelete="SET NULL")),
        sa.Column("supporting_data", sa.Text()),
        sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("notes", sa.Text()),
        sa.Column("source_module", sa.String(100)),
        sa.Column("auto_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", postgresql.UUID(as_uuid=False),
                  sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("idx_leads_status", "investigative_leads", ["status"])
    op.create_index("idx_leads_lead_type", "investigative_leads", ["lead_type"])
    op.create_index("idx_leads_subject_id", "investigative_leads", ["subject_id"])
    op.create_index("idx_leads_case_id", "investigative_leads", ["case_id"])


def downgrade() -> None:
    op.drop_table("investigative_leads")
