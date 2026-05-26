import os
import glob
import re

router_dir = "routers"
files = glob.glob(os.path.join(router_dir, "*.py"))

def get_action_for_method(method: str) -> str:
    method = method.lower()
    if method == "get":
        return "read"
    elif method in ["post", "put", "patch"]:
        return "write"
    elif method == "delete":
        return "delete"
    return "read"

def process_file(filepath):
    basename = os.path.basename(filepath)
    if basename in ["__init__.py", "auth.py", "roles.py", "permissions.py", "profiles.py", "webhooks.py"]:
        return
        
    resource = basename.replace(".py", "")
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # We will split by lines and look for @router.METHOD
    lines = content.split("\n")
    new_lines = []
    
    current_method = None
    
    for line in lines:
        match = re.match(r'^@router\.(get|post|put|patch|delete)\(', line.strip())
        if match:
            current_method = match.group(1)
            
        if "Depends(auth.get_current_user)" in line and current_method:
            action = get_action_for_method(current_method)
            replacement = f'Depends(auth.require_permission("{resource}", "{action}"))'
            line = line.replace("Depends(auth.get_current_user)", replacement)
            # Reset current_method after replacing to avoid leaking
            current_method = None
            
        new_lines.append(line)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(new_lines))
        
    print(f"Updated {basename}")

for file in files:
    process_file(file)

print("Done updating routers.")
