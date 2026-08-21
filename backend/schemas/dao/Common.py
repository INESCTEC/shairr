from abc import abstractmethod
from typing import TypeVar, Optional

from pydantic import BaseModel

from core import Database

BaseSQLAlchemyModel = TypeVar('BaseSQLAlchemyModel', bound=Database.DeclarativeBase)

class BaseRepository:
    @classmethod
    @property
    @abstractmethod
    def model(cls) -> Database.DeclarativeBase:
        raise NotImplementedError

    @classmethod
    def exists(cls, id: int) -> bool:
        with Database.SessionManager() as db:
            return db.exists(cls.model).where(cls.model.id == id).scalar()

    @classmethod
    def get_all(
            cls,
            limit: Optional[int] = None,
            page: int = 1,
            search: str = "",
    ) -> list["BaseSQLAlchemyModel"]:
        if page < 1:
            page = 1

        with Database.SessionManager() as db:
            q = db.query(cls.model)

            if search:
                q = q.filter(cls.model.name.contains(search))

            # Only paginate if a limit was provided
            if limit is not None:
                if limit < 1:
                    limit = 1
                offset = (page - 1) * limit
                q = q.limit(limit).offset(offset)

            return q.all()

    @classmethod
    def get(cls, id_model: int) -> BaseSQLAlchemyModel:
        with Database.SessionManager() as db:
            return db.query(cls.model).where(cls.model.id == id_model).first()

    @classmethod
    def create(cls, db_declarative_obj: Database.DeclarativeBase) -> BaseSQLAlchemyModel:
        with Database.SessionManager() as db:
            db.add(db_declarative_obj)
            db.commit()
            db.refresh(db_declarative_obj)

            return db_declarative_obj

    @classmethod
    def create_from_pydantic(cls, model_create: BaseModel) -> BaseSQLAlchemyModel:
        obj_create = cls.model(**model_create.model_dump())
        return cls.create(obj_create)
    
    @classmethod
    def update_from_pydantic(cls, id_model: int, pydantic_model: BaseModel) -> BaseSQLAlchemyModel | None:
        """Update a record from a Pydantic model"""
        db_obj = cls.get(id_model)

        if not db_obj:
            return None
        
        # Update fields from Pydantic model
        update_data = pydantic_model.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        with Database.SessionManager() as db:
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
        
        return db_obj

    @classmethod
    def update(cls, id_model, fields_to_update: dict[str, any]) -> BaseSQLAlchemyModel | None:
        with Database.SessionManager() as db:
            # Get the object directly
            obj = db.query(cls.model).filter(cls.model.id == id_model).first()
            
            if not obj:
                return None
            
            # Update the object attributes directly
            for key, value in fields_to_update.items():
                setattr(obj, key, value)
            
            # Commit and refresh
            db.commit()
            db.refresh(obj)
            
            return obj

    @classmethod
    def update_by_criterion(cls, filter_criterion, fields_to_update: dict[str, any]) -> BaseSQLAlchemyModel | None:
        with Database.SessionManager() as db:
            query = db.query(cls.model).filter(*filter_criterion)
            
            # Get the object BEFORE update
            obj = query.first()
            if not obj:
                return None
            
            # Use query.update() which properly handles TypeDecorator
            # synchronize_session='evaluate' or 'fetch' will keep the session in sync
            query.update(fields_to_update, synchronize_session='evaluate')
            
            # Now get the updated object fresh from database
            updated_obj = query.first()
            
            db.commit()
            
            return updated_obj
        
    @classmethod
    def remove(cls, id_model) -> bool:
        criterion = [cls.model.id == id_model]
        return cls.remove_by_criterion(criterion)

    @classmethod
    def remove_by_criterion(cls, filter_criterion) -> bool:
        with Database.SessionManager() as db:
            query = db.query(cls.model).filter(*filter_criterion)

            if not query.first():
                return False

            query.delete(synchronize_session=False)

            db.commit()

            return True

    @classmethod
    def generate_csv(cls, id_model: int):
        db_obj = cls.get(id_model)
        if not db_obj:
            return ""

        import csv
        from io import StringIO

        ontology_fields = ['species', 'tissue', 'cell_subset']
        skip = ['id_study']
        
        # Get base columns
        cols = [c.name for c in cls.model.__table__.columns]
        
        has_genotypes = hasattr(cls.model, 'genotypes')
        if has_genotypes:
            cols.append('genotypes')
        
        new_cols = []
        for col in cols:
            if col in ontology_fields:
                new_cols.append(f"{col}_label")
                new_cols.append(f"{col}_id")
            else:
                new_cols.append(col)
        
        output = StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)
        writer.writerow(new_cols)
        
        row_data = []
        for col in new_cols:
            if col in skip:
                continue
                
            if col.endswith('_label'):
                original_field = col[:-6]
            elif col.endswith('_id') and col[:-3] in ontology_fields:
                original_field = col[:-3]
            else:
                original_field = col
            
            value = getattr(db_obj, original_field, None)
            
            if original_field in ontology_fields and value:
                if isinstance(value, str):
                    if value.strip().startswith('{'):
                        import ast
                        parsed = ast.literal_eval(value)
                        if col.endswith('_id'):
                            row_data.append(parsed.get('id', ''))
                        else:
                            row_data.append(parsed.get('label', ''))
                    else:
                        row_data.append('')
                elif isinstance(value, dict):
                    if col.endswith('_id'):
                        row_data.append(value.get('id', ''))
                    else:
                        row_data.append(value.get('label', ''))
                else:
                    row_data.append('')
            else:
                if value is None:
                    row_data.append('')
                elif original_field == 'genotypes' and has_genotypes:
                    if value:
                        items = []
                        for g in value:
                            items.append(f"{g.name}({g.mhc_class})")
                        row_data.append(';'.join(items))
                    else:
                        row_data.append('')
                elif isinstance(value, bool):
                    row_data.append(str(value).lower())
                else:
                    row_data.append(str(value))
        
        writer.writerow(row_data)
        return output.getvalue()