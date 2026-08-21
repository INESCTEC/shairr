from sqlalchemy.exc import IntegrityError

from core import Database
from schemas.db.User import User
from schemas.json.User import UserPatch


class UserRepository:
    @staticmethod
    def get(id_keycloak: str) -> User:
        with Database.SessionManager() as db:
            return db.query(User).where(User.id_keycloak == id_keycloak).first()

    @staticmethod
    def get_or_create(id_keycloak: str):
        """
        Get existing user or create new one if doesn't exist
        """
        with Database.SessionManager() as db:
            # Try to get existing user first
            user = db.query(User).filter(User.id_keycloak == id_keycloak).first()
            
            if user:
                return user
            
            # User doesn't exist, create new one
            try:
                new_user = User(id_keycloak=id_keycloak)
                db.add(new_user)
                db.commit()
                db.refresh(new_user)
                return new_user
            except IntegrityError:
                # Handle race condition where user was created between query and insert
                db.rollback()
                return db.query(User).filter(User.id_keycloak == id_keycloak).first()

    @staticmethod
    def update_by_id_keycloak(id_keycloak: str, user_patch: UserPatch) -> User | None:
        user_obj = UserRepository.get(id_keycloak)

        update_data = user_patch.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(user_obj, field, value)

        with Database.SessionManager() as db:
            db.add(user_obj)
            db.commit()
            db.refresh(user_obj)

        return user_obj