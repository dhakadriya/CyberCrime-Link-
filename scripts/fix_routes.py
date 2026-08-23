"""
Fix all router GET / endpoints to also respond on GET "" (no trailing slash).
This is needed because redirect_slashes=False in FastAPI means /audit (no slash) 
won't match /audit/ — both paths must be registered.
"""
import re, os, glob

router_files = glob.glob('backend/app/modules/**/router.py', recursive=True)

for fpath in router_files:
    with open(fpath, encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: @router.get("/", response_model=... that is a list endpoint
    # Replace with double decorator (both "" and "/")
    original = content
    
    # Match single @router.get("/", ...) not already doubled
    pattern = r'(@router\.get\(\s*"/",\s*(response_model=[^\n]+))'
    
    def replace_slash(m):
        full = m.group(0)
        # Check if already has "" version above
        return full
    
    # Simpler: just ensure each @router.get("/", ...) also has @router.get("", ...)
    lines = content.split('\n')
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # If this line is @router.get("/", ...) and previous line is NOT @router.get("", ...)
        stripped = line.strip()
        if stripped.startswith('@router.get("/",') or stripped == '@router.get("/",':
            # Check if previous non-empty line already added the "" version
            prev = ''
            for j in range(len(new_lines)-1, -1, -1):
                if new_lines[j].strip():
                    prev = new_lines[j].strip()
                    break
            if not prev.startswith('@router.get("",'):
                # Add "" version before this line
                # Replace "/" with "" in the decorator
                empty_line = line.replace('get("/",', 'get("",', 1)
                # Add include_in_schema=False to the "" version
                if 'include_in_schema' not in empty_line:
                    if empty_line.rstrip().endswith(')'):
                        empty_line = empty_line.rstrip()[:-1] + ', include_in_schema=False)'
                    else:
                        # multiline — add before closing paren on same line isn't possible
                        # just add the decorator without include_in_schema
                        empty_line = line.replace('get("/",', 'get("",', 1)
                new_lines.append(empty_line)
        new_lines.append(line)
        i += 1
    
    new_content = '\n'.join(new_lines)
    if new_content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Fixed: {fpath}')
    else:
        print(f'No change: {fpath}')

print('Done.')
