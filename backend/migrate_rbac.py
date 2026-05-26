import os
import sys
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal, engine
import models

def migrate():
    print("Migrating RBAC...")
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Ensure role_id exists on profiles table (create_all does not add columns)
    try:
        db.execute(text("SELECT role_id FROM profiles LIMIT 1"))
    except Exception:
        db.rollback()
        print("Adding role_id column to profiles...")
        db.execute(text("ALTER TABLE profiles ADD COLUMN role_id VARCHAR REFERENCES roles(id)"))
        db.commit()
    
    # 1. Define all standard permissions
    perms = [
        ("deals", "read", "View deals"),
        ("deals", "write", "Create and edit deals"),
        ("deals", "delete", "Delete deals"),
        ("contacts", "read", "View contacts"),
        ("contacts", "write", "Create and edit contacts"),
        ("contacts", "delete", "Delete contacts"),
        ("companies", "read", "View companies"),
        ("companies", "write", "Create and edit companies"),
        ("companies", "delete", "Delete companies"),
        ("leads", "read", "View leads"),
        ("leads", "write", "Create and edit leads"),
        ("leads", "delete", "Delete leads"),
        ("settings", "manage", "Manage system settings and billing"),
        ("users", "manage", "Add/remove users and manage roles"),
        ("mailer", "use", "Send bulk and single emails")
    ]
    
    perm_map = {}
    for res, act, desc in perms:
        p = db.query(models.Permission).filter_by(resource=res, action=act).first()
        if not p:
            p = models.Permission(resource=res, action=act, description=desc)
            db.add(p)
            db.commit()
            db.refresh(p)
        perm_map[f"{res}:{act}"] = p
    
    # 2. Define standard roles
    roles_def = {
        "admin": {
            "desc": "Full access to all system features.",
            "perms": list(perm_map.values())
        },
        "manager": {
            "desc": "Manage deals, contacts, leads, and emails.",
            "perms": [p for p in perm_map.values() if p.resource not in ("settings", "users")]
        },
        "rep": {
            "desc": "Standard sales representative access.",
            "perms": [p for p in perm_map.values() if p.resource not in ("settings", "users") and p.action != "delete"]
        },
        "read_only": {
            "desc": "Can only view records.",
            "perms": [p for p in perm_map.values() if p.action == "read"]
        }
    }
    
    role_map = {}
    for name, data in roles_def.items():
        r = db.query(models.Role).filter_by(name=name).first()
        if not r:
            r = models.Role(name=name, description=data["desc"], is_system=True)
            db.add(r)
            db.commit()
            db.refresh(r)
        
        # Attach permissions
        for p in data["perms"]:
            rp = db.query(models.RolePermission).filter_by(role_id=r.id, permission_id=p.id).first()
            if not rp:
                db.add(models.RolePermission(role_id=r.id, permission_id=p.id))
        
        db.commit()
        role_map[name] = r
    
    # 3. Migrate Users
    users = db.query(models.Profile).all()
    migrated = 0
    for u in users:
        if not u.role_id:
            role_name = u.legacy_role.value if u.legacy_role else "read_only"
            target_role = role_map.get(role_name, role_map["read_only"])
            u.role_id = target_role.id
            migrated += 1
    
    db.commit()
    print(f"Migrated {migrated} users to RBAC.")
    db.close()

if __name__ == "__main__":
    migrate()
