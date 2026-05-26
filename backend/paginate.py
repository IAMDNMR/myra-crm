import re

files_standard = [
    "leads.py", "pipelines.py", "products.py", "profiles.py", "stages.py", "tasks.py", "task_statuses.py"
]

for file in files_standard:
    path = f"c:\\Users\\iamdn\\OneDrive\\Desktop\\myra-crm\\myra\\backend\\routers\\{file}"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    content = re.sub(
        r"def get_all\(db: Session",
        r"def get_all(skip: int = 0, limit: int = 100, db: Session",
        content, count=1
    )
    content = re.sub(
        r"(return db\.query\([^\)]+\))(\.order_by\([^\)]+\))?\.all\(\)",
        r"\1\2.offset(skip).limit(limit).all()",
        content, count=1
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

# quotes.py is special
path = f"c:\\Users\\iamdn\\OneDrive\\Desktop\\myra-crm\\myra\\backend\\routers\\quotes.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()
content = re.sub(
    r"def get_all\(deal_id: Optional\[str\] = None, db: Session",
    r"def get_all(deal_id: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session",
    content, count=1
)
content = re.sub(
    r"return q\.all\(\)",
    r"return q.offset(skip).limit(limit).all()",
    content, count=1
)
with open(path, "w", encoding="utf-8") as f:
    f.write(content)
