"""Package portable source, excluding local secrets and generated state."""
from pathlib import Path
import os
import hashlib
import zipfile
root=Path(__file__).resolve().parent.parent
archive=root.parent/'karakalpakstan-travel-source.zip'
excluded={'.git','node_modules','.next','dist','test-results','playwright-report','coverage','__pycache__'}
files=[]
for directory, dirs, names in os.walk(root):
    dirs[:]=[d for d in dirs if d not in excluded]
    for name in names:
        if (name.startswith('.env') and name!='.env.example') or name.endswith(('.tsbuildinfo','.log','.zip')):
            continue
        file=Path(directory)/name
        if file.is_symlink():
            continue
        files.append(file)
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as output:
    for file in sorted(files):
        output.write(file,'karakalpakstan-travel/'+file.relative_to(root).as_posix())
with zipfile.ZipFile(archive) as output:
    assert output.testzip() is None
    assert not any('/.env' in p and not p.endswith('/.env.example') for p in output.namelist())
    assert 'karakalpakstan-travel/package-lock.json' in output.namelist()
print(f'{archive}\n{len(files)} files\n{archive.stat().st_size:,} bytes\nSHA256 {hashlib.sha256(archive.read_bytes()).hexdigest()}')
