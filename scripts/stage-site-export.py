#!/usr/bin/env python3
"""Safely unpack an original ChatGPT Site source ZIP without changing source files."""
import argparse
import hashlib
import json
import shutil
import stat
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

parser = argparse.ArgumentParser(description="Stage original Minute Arcade Site export verbatim.")
parser.add_argument("archive", type=Path, help="Original unmodified Site ZIP from Codex")
parser.add_argument("destination", type=Path, help="A new empty staging directory")
args = parser.parse_args()
assert args.archive.is_file(), "Source ZIP not found"
dest = args.destination.resolve()
assert not dest.exists() or (dest.is_dir() and not any(dest.iterdir())), "Destination must be new or empty"
rows = []
with ZipFile(args.archive) as archive:
    seen = set()
    for member in archive.infolist():
        name = member.filename.replace("\\", "/")
        pure = PurePosixPath(name)
        assert not pure.is_absolute() and ".." not in pure.parts and ":" not in pure.parts[0], "Unsafe path: " + name
        assert ".git" not in pure.parts, "Source ZIP contains Git internal metadata: " + name
        assert not stat.S_ISLNK(member.external_attr >> 16), "Symlink requires manual review: " + name
        normalized = str(pure)
        if member.is_dir() or normalized in ("", "."):
            continue
        assert normalized not in seen, "Duplicate archive file: " + normalized
        seen.add(normalized)
        rows.append((member, normalized))
    assert rows, "Archive has no source files"
    dest.mkdir(parents=True, exist_ok=True)
    manifest = []
    for member, name in rows:
        target = dest / name
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256()
        with archive.open(member, "r") as inp, target.open("xb") as out:
            while chunk := inp.read(1024 * 1024):
                digest.update(chunk)
                out.write(chunk)
        manifest.append({"path": name, "bytes": member.file_size, "sha256": digest.hexdigest()})
report = dest.parent / (dest.name + "-integrity.json")
report.write_text(json.dumps({"source_zip": args.archive.name, "count": len(manifest), "files": manifest}, indent=2) + "\n")
print("Staged", len(manifest), "exact files at", dest)
print("Integrity manifest:", report)
print("No source files or production services were modified.")
