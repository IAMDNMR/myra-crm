from database import SessionLocal
import models
import auth
import uuid
import os

def seed_defaults():
    db = SessionLocal()
    try:
        # Check if default pipeline exists
        default_pipeline = db.query(models.Pipeline).filter(models.Pipeline.is_default == True).first()
        if not default_pipeline:
            default_pipeline = models.Pipeline(
                id=str(uuid.uuid4()),
                name="Standard Sales Pipeline",
                is_default=True
            )
            db.add(default_pipeline)
            db.commit()

            stages = [
                ("New Lead", 0, 10, "#9b59b6"),
                ("Initial Discussion", 1, 30, "#3498db"),
                ("Demo Scheduled", 2, 50, "#f1c40f"),
                ("Proposal Shared", 3, 70, "#e67e22"),
                ("Negotiation", 4, 90, "#e74c3c"),
                ("Won", 5, 100, "#2ecc71"),
                ("Lost", 6, 0, "#95a5a6"),
            ]
            for name, idx, prob, color in stages:
                stage = models.Stage(
                    id=str(uuid.uuid4()),
                    pipeline_id=default_pipeline.id,
                    name=name,
                    order_index=idx,
                    probability=prob,
                    color=color
                )
                db.add(stage)
            db.commit()

        # Check if custom task statuses exist
        default_status = db.query(models.CustomTaskStatus).first()
        if not default_status:
            statuses = [
                ("To Do", 0, "#95a5a6", False),
                ("In Progress", 1, "#3498db", False),
                ("Under Review", 2, "#f1c40f", False),
                ("Done", 3, "#2ecc71", True),
                ("Cancelled", 4, "#e74c3c", True),
            ]
            for name, idx, color, closed in statuses:
                s = models.CustomTaskStatus(
                    id=str(uuid.uuid4()),
                    name=name,
                    color=color,
                    order_index=idx,
                    is_closed_state=closed
                )
                db.add(s)
            db.commit()

        # Check and create superuser from env if provided
        su_email = os.getenv("SUPERUSER_EMAIL")
        su_password = os.getenv("SUPERUSER_PASSWORD")
        if su_email and su_password:
            su_profile = db.query(models.Profile).filter(models.Profile.email == su_email).first()
            hashed_pw = auth.get_password_hash(su_password)
            if not su_profile:
                su_profile = models.Profile(
                    id=str(uuid.uuid4()),
                    email=su_email,
                    full_name="Super Admin",
                    hashed_password=hashed_pw,
                    legacy_role=models.AppRole.admin
                )
                db.add(su_profile)
            else:
                su_profile.hashed_password = hashed_pw
            db.commit()

    finally:
        db.close()

if __name__ == "__main__":
    seed_defaults()
