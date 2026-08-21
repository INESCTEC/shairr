from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

import sys
import os

sys.path.append(
    os.path.dirname(
        os.path.dirname(
            os.path.dirname(__file__)
        )
    )
)

from core.Seeding import seed_table


revision: str = "22055080ce6c"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ------------------------------------------------------------------
    # dataset_group
    # ------------------------------------------------------------------

    op.create_table(
        "dataset_group",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id")
    )

    op.create_index("ix_dataset_group_id", "dataset_group", ["id"])
    op.create_index("ix_dataset_group_name", "dataset_group", ["name"])

    # ------------------------------------------------------------------
    # study
    # ------------------------------------------------------------------

    op.create_table(
        "study",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("study_id", sa.String(), nullable=True),
        sa.Column("study_title", sa.String(), nullable=True),
        sa.Column("study_description", sa.String(), nullable=True),
        sa.Column("contributors", sa.String(), nullable=True),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("study_id", name="uq_study_study_id")
    )

    op.create_index("ix_study_id", "study", ["id"])

    # ------------------------------------------------------------------
    # user
    # ------------------------------------------------------------------

    op.create_table(
        "user",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_keycloak", sa.String(), nullable=True),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "id_keycloak",
            name="uq_user_id_keycloak"
        )
    )

    op.create_index("ix_user_id", "user", ["id"])

    # ------------------------------------------------------------------
    # dataset
    # ------------------------------------------------------------------

    op.create_table(
        "dataset",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(), nullable=True),
        sa.Column("filepath", sa.String(), nullable=True),
        sa.Column("filesize", sa.Float(), nullable=True),
        sa.Column("line_count", sa.Integer(), nullable=True),
        sa.Column(
            "time_created",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=True
        ),
        sa.Column("annotated", sa.Boolean(), nullable=True),
        sa.Column("id_group", sa.Integer(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_group"],
            ["dataset_group.id"],
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_dataset_id", "dataset", ["id"])

    # ------------------------------------------------------------------
    # subject
    # ------------------------------------------------------------------

    op.create_table(
        "subject",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_study", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.String(), nullable=True),
        sa.Column("synthetic", sa.Boolean(), nullable=True),
        sa.Column("species", sa.String(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.UniqueConstraint(
            "subject_id",
            name="uq_subject_subject_id"
        ),

        sa.ForeignKeyConstraint(
            ["id_study"],
            ["study.id"],
            name="fk_subject_study",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_subject_id", "subject", ["id"])

    # ------------------------------------------------------------------
    # diagnosis
    # ------------------------------------------------------------------

    op.create_table(
        "diagnosis",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("disease_diagnosis", sa.String(), nullable=True),
        sa.Column("disease_stage", sa.String(), nullable=True),
        sa.Column("immunogen", sa.String(), nullable=True),
        sa.Column("id_subject", sa.Integer(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_subject"],
            ["subject.id"],
            name="fk_diagnosis_subject",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_diagnosis_id", "diagnosis", ["id"])

    # ------------------------------------------------------------------
    # genotype
    # ------------------------------------------------------------------

    op.create_table(
        "genotype",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "mhc_class",
            sa.Enum(
                "CLASS_I",
                "CLASS_II",
                name="mhcclass"
            ),
            nullable=False
        ),
        sa.Column("id_subject", sa.Integer(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_subject"],
            ["subject.id"],
            name="fk_genotype_subject",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_genotype_id", "genotype", ["id"])
    op.create_index("ix_genotype_name", "genotype", ["name"])

    # ------------------------------------------------------------------
    # time_point
    # ------------------------------------------------------------------

    op.create_table(
        "time_point",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_subject", sa.Integer(), nullable=True),
        sa.Column("id_relative_time_point", sa.Float(), nullable=True),
        sa.Column("units_of_measurement", sa.String(), nullable=True),
        sa.Column("time_point", sa.Float(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_subject"],
            ["subject.id"],
            name="fk_time_point_subject",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_time_point_id", "time_point", ["id"])

    # ------------------------------------------------------------------
    # sample
    # ------------------------------------------------------------------

    op.create_table(
        "sample",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_subject", sa.Integer(), nullable=True),
        sa.Column("id_study", sa.Integer(), nullable=True),
        sa.Column("id_timepoint", sa.Integer(), nullable=True),
        sa.Column("sample_id", sa.String(), nullable=False),
        sa.Column("sample_type", sa.String(), nullable=True),
        sa.Column("tissue", sa.String(), nullable=True),
        sa.Column("cell_subset", sa.String(), nullable=True),
        sa.Column("cell_phenotype", sa.String(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_subject"],
            ["subject.id"],
            name="fk_sample_subject",
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["id_study"],
            ["study.id"],
            name="fk_sample_study",
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["id_timepoint"],
            ["time_point.id"],
            name="fk_sample_time_point",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_sample_id", "sample", ["id"])

    # ------------------------------------------------------------------
    # read
    # ------------------------------------------------------------------

    op.create_table(
        "read",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_dataset", sa.Integer(), nullable=True),
        sa.Column("id_sample", sa.Integer(), nullable=True),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_dataset"],
            ["dataset.id"],
            name="fk_read_dataset",
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["id_sample"],
            ["sample.id"],
            name="fk_read_sample",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_read_id", "read", ["id"])

    # ------------------------------------------------------------------
    # annotation
    # ------------------------------------------------------------------

    op.create_table(
        "annotation",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_sample", sa.Integer(), nullable=True),
        sa.Column("id_read", sa.Integer(), nullable=True),
        sa.Column("id_dataset", sa.Integer(), nullable=False),

        sa.PrimaryKeyConstraint("id"),

        sa.ForeignKeyConstraint(
            ["id_sample"],
            ["sample.id"],
            name="fk_annotation_sample",
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["id_read"],
            ["read.id"],
            name="fk_annotation_read",
            ondelete="CASCADE"
        ),

        sa.ForeignKeyConstraint(
            ["id_dataset"],
            ["dataset.id"],
            name="fk_annotation_dataset",
            ondelete="CASCADE"
        )
    )

    op.create_index("ix_annotation_id", "annotation", ["id"])

    connection = op.get_bind()

    for table_name in [
        "dataset_group",
        "study",
        "subject",
        "diagnosis",
        "genotype",
        "time_point",
        "sample",
        "dataset"
    ]:
        metadata = sa.MetaData()
        metadata.reflect(bind=connection, only=[table_name])
        seed_table(metadata.tables[table_name], connection)


def downgrade() -> None:

    op.drop_index("ix_annotation_id", table_name="annotation")
    op.drop_table("annotation")

    op.drop_index("ix_read_id", table_name="read")
    op.drop_table("read")

    op.drop_index("ix_sample_id", table_name="sample")
    op.drop_table("sample")

    op.drop_index("ix_time_point_id", table_name="time_point")
    op.drop_table("time_point")

    op.drop_index("ix_genotype_name", table_name="genotype")
    op.drop_index("ix_genotype_id", table_name="genotype")
    op.drop_table("genotype")

    op.drop_index("ix_diagnosis_id", table_name="diagnosis")
    op.drop_table("diagnosis")

    op.drop_index("ix_subject_id", table_name="subject")
    op.drop_table("subject")

    op.drop_index("ix_dataset_id", table_name="dataset")
    op.drop_table("dataset")

    op.drop_index("ix_user_id", table_name="user")
    op.drop_table("user")

    op.drop_index("ix_study_id", table_name="study")
    op.drop_table("study")

    op.drop_index("ix_dataset_group_name", table_name="dataset_group")
    op.drop_index("ix_dataset_group_id", table_name="dataset_group")
    op.drop_table("dataset_group")