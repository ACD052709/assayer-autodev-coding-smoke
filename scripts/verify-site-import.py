#!/usr/bin/env python3
"""Verify imported source bytes against the original Site ZIP manifest."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath

parser = argparse.ArgumentParser()
parser.add_argument("integrity_json", type=Path)
parser.add_argument("imported_root", type=Path)
args = parser.parse_args()
data = json.loads(args.integrity_json.read_text())
root = args.imported_root.resolve()
files = data["files"]
assert files and len(files) == data["count"], "Invalid source manifest"
for row in files:
    p = PurePosixPath(row["path"])
    assert not p.is_absolute() and ".." not in p.parts, "Invalid path"
    target = (root / row["path"]).resolve()
    assert target.is_relative_to(root), "File escapes import root"
    assert target.is_file(), "Missing source file: " + row["path"]
    assert target.stat().st_size == row["bytes"], "Wrong byte count: " + row["path"]
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    assert digest == row["sha256"], "SHA-256 mismatch: " + row["path"]
print("PASS:", len(files), "files match exact original exported bytes")
