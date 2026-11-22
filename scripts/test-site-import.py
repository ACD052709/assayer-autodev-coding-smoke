#!/usr/bin/env python3
"""Test exact ZIP import, checksum verification, and safety checks."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

script = Path(__file__).with_name("stage-site-export.py")
verify = Path(__file__).with_name("verify-site-import.py")
with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    original = root / "original.zip"
    with ZipFile(original, "w") as z:
        z.writestr("minute-arcade/index.html", b"<title>Minute Arcade</title>\n")
        z.writestr("minute-arcade/server/routes.js", b"export default {}\n")
    target = root / "staged"
    ok = subprocess.run([sys.executable, str(script), str(original), str(target)], capture_output=True, text=True)
    assert ok.returncode == 0, ok.stderr
    manifest = root / "staged-integrity.json"
    data = json.loads(manifest.read_text())
    assert data["count"] == 2
    checked = subprocess.run([sys.executable, str(verify), str(manifest), str(target)], capture_output=True, text=True)
    assert checked.returncode == 0, checked.stderr
    (target / "minute-arcade/server/routes.js").write_bytes(b"tampered")
    corrupt = subprocess.run([sys.executable, str(verify), str(manifest), str(target)], capture_output=True, text=True)
    assert corrupt.returncode != 0, "Tampered import unexpectedly passed"
    malicious = root / "traversal.zip"
    with ZipFile(malicious, "w") as z:
        z.writestr("../escape.txt", b"no")
    rejected = subprocess.run([sys.executable, str(script), str(malicious), str(root / "blocked")], capture_output=True, text=True)
    assert rejected.returncode != 0, "Unsafe ZIP was accepted"
    assert not (root / "escape.txt").exists()
print("PASS: exact ZIP import, manifest verification, tamper detection, path traversal rejection")
