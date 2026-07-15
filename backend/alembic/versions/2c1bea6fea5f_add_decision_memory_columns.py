"""add_decision_memory_columns

Revision ID: 2c1bea6fea5f
Revises: 1af86d8332ee
Create Date: 2026-06-18 17:58:46.557533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c1bea6fea5f'
down_revision: Union[str, Sequence[str], None] = '1af86d8332ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
