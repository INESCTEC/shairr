# Receives a table, a connection and inserts data to that table.
# Used for seeding initial data.
# Source-code based on:
#   - https://gist.github.com/jsmsalt/26bf25844870d59eee17997727e3a631

INITIAL_DATA = {
    "repository": [
        {"id": 1,
         "name": 'My Lab Repository'}
    ],
    "dataset_group": [
        {
            "id": 1,
            "name": "ADAM_TP1"
        },
        {
            "id": 2,
            "name": "ADAM_TP3"
        },
        {
            "id": 3,
            "name": "EVE_TP1"
        },
        {
            "id": 4,
            "name": "Unassigned Group"
        }
    ],
    "study": [
        {
            "id": 1,
            "study_id": "IFPR0001",
            "study_title": "Influenza Puerto Rico",
            "study_description": "A population study",
            "contributors": "Lab of special people"
        },
        {
            "id": 2,
            "study_id": "IFLUMOUSE2024",
            "study_title": "Influenza BCR Repertoire Dynamics Post-Infection/Vaccination",
            "study_description": "Single-cell BCR sequencing of mouse samples at 14- and 21-days post influenza challenge or vaccination.",
            "contributors": "Elias et al."
        }
    ],
    "subject": [
        {
            "id": 1,
            "id_study": 1,
            "subject_id": "ADAM0001",
            "synthetic": False,
            "species": {
                "id": "HS",
                "label": "Homo Sapiens"
            }
        },
        {
            "id": 2,
            "id_study": 1,
            "subject_id": "EVE00001",
            "synthetic": False,
            "species": {
                "id": "HS",
                "label": "Homo Sapiens"
            }
        },
        {
            "id": 3,
            "id_study": 2,
            "subject_id": "GCF663",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        },
        {
            "id": 4,
            "id_study": 2,
            "subject_id": "GCF0705-2",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        },
        {
            "id": 5,
            "id_study": 2,
            "subject_id": "GCF0705-3",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        },
        {
            "id": 6,
            "id_study": 2,
            "subject_id": "GCF0705",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        },
        {
            "id": 7,
            "id_study": 2,
            "subject_id": "E70",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        },
        {
            "id": 8,
            "id_study": 2,
            "subject_id": "PF13",
            "synthetic": True,
            "species": {
                "id": "MM",
                "label": "Mus musculus"
            }
        }
    ],
    "genotype": [
        {
            "id": 1,
            "name": "HLA-A*02:01:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 1
        },
        {
            "id": 2,
            "name": "HLA-A*03:05:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 1
        },
        {
            "id": 3,
            "name": "HLA-A*04:03:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 1
        },
        {
            "id": 4,
            "name": "HLA-C*05:01:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 2
        },
        {
            "id": 5,
            "name": "HLA-C*07:05:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 2
        },
        {
            "id": 6,
            "name": "HLA-C*01:03:01:01",
            "mhc_class": "CLASS_I",
            "id_subject": 2
        }
    ],
    "diagnosis": [
        {
            "id": 1,
            "id_subject": 1,
            "disease_diagnosis": {
                "id": "DOID:0050844",
                "label": "spasmodic dystonia"
            },
            "disease_stage": "active",
            "immunogen": None
        },
        {
            "id": 2,
            "id_subject": 2,
            "disease_diagnosis": {
                "id": "DOID:0080302",
                "label": "mixed sleep apnea"
            },
            "disease_stage": "active",
            "immunogen": None
        }
    ],
    "time_point": [
        {
            "id": 1,
            "id_subject": 1,
            "id_relative_time_point": 1,
            "units_of_measurement": "days",
            "time_point": 14,
            "description": "Pre-vax"
        },
        {
            "id": 2,
            "id_subject": 1,
            "id_relative_time_point": 2,
            "units_of_measurement": "days",
            "time_point": 20,
            "description": "Immunization"
        },
        {
            "id": 3,
            "id_subject": 1,
            "id_relative_time_point": 3,
            "units_of_measurement": "days",
            "time_point": 30,
            "description": "Post-vax"
        },
        {
            "id": 4,
            "id_subject": 2,
            "id_relative_time_point": None,
            "units_of_measurement": "days",
            "time_point": 0,
            "description": "Infection"
        },
        {
            "id": 5,
            "id_subject": 2,
            "id_relative_time_point": 2,
            "units_of_measurement": "days",
            "time_point": 30,
            "description": "Diagnosis"
        }
    ],
    "sample": [
        {
            "id": 1,
            "id_subject": 1,
            "id_study": 1,
            "id_timepoint": 1,
            "sample_id": "SAMPLE001",
            "sample_type": "harvest",
            "tissue": {
                "id": "UBERON:0002048",
                "label": "blood"
            },
            "cell_subset": {"id": "CL:000023", "label": "B cell"},
            "cell_phenotype": "IgG",
            "sequencing_type": "BULK"
        },
        {
            "id": 2,
            "id_subject": 1,
            "id_study": 1,
            "id_timepoint": 3,
            "sample_id": "SAMPLE002",
            "sample_type": "harvest",
            "tissue": {
                "id": "UBERON:0002048",
                "label": "blood"
            },
            "cell_subset": {"id": "CL:000023", "label": "B cell"},
            "cell_phenotype": "IgG",
            "sequencing_type": "BULK"
        },
        {
            "id": 3,
            "id_subject": 2,
            "id_study": 1,
            "id_timepoint": 5,
            "sample_id": "SAMPLE003",
            "sample_type": "needle-point",
            "tissue": {
                "id": "UBERON:0001024",
                "label": "marrow"
            },
            "cell_subset": {"id": "CL:000023", "label": "B cell"},
            "cell_phenotype": "CD8",
            "sequencing_type": "SINGLE_CELL"
        }
    ],
    "dataset": [
        {
            "id": 1,
            "filename": "unassigned_dataset.fastq.gz",
            "filepath": "/tmp",
            "filesize": 1000000,
            "line_count": 10000,
            "annotated": False,
            "id_group": 4
        }
    ]
}

import json

def seed_table(target, connection, **kw):
    tablename = str(target)
    if tablename not in INITIAL_DATA or not INITIAL_DATA[tablename]:
        return
    
    data = INITIAL_DATA[tablename]
    
    for record in data:
        for key, value in record.items():
            if isinstance(value, dict):
                record[key] = json.dumps(value)
    
    pk_columns = [col.name for col in target.primary_key.columns]
    
    if not pk_columns:
        connection.execute(target.insert(), data)
        return
    
    from sqlalchemy import text, Table, MetaData

    metadata = MetaData()
    metadata.reflect(bind=connection)
    table_obj = Table(tablename, metadata, autoload_with=connection)
    
    if len(pk_columns) == 1:
        pk_col = pk_columns[0]
        
        existing_records = {}
        for row in connection.execute(text(f"SELECT * FROM {tablename}")):
            row_dict = dict(row._mapping)
            pk_value = row_dict.get(pk_col)
            if pk_value:
                existing_records[pk_value] = row_dict
        
        for record in data:
            pk_value = record.get(pk_col)
            if pk_value in existing_records:
                existing_row = existing_records[pk_value]
                needs_update = False
                update_data = {}
                
                for col_name, new_value in record.items():
                    if col_name not in existing_row or existing_row[col_name] != new_value:
                        needs_update = True
                        update_data[col_name] = new_value
                
                if needs_update and update_data:
                    update_stmt = table_obj.update().where(getattr(table_obj.c, pk_col) == pk_value).values(**update_data)
                    connection.execute(update_stmt)
            else:
                connection.execute(table_obj.insert(), record)
    else:
        existing_keys = set()
        for row in connection.execute(text(f"SELECT {', '.join(pk_columns)} FROM {tablename}")):
            row_dict = dict(row._mapping)
            key_tuple = tuple(row_dict.get(col) for col in pk_columns)
            existing_keys.add(key_tuple)
        
        new_data = []
        for record in data:
            key_tuple = tuple(record.get(col) for col in pk_columns)
            if key_tuple not in existing_keys:
                new_data.append(record)
        
        if new_data:
            connection.execute(table_obj.insert(), new_data)