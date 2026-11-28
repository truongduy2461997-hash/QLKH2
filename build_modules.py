"""Đóng gói và kiểm chứng module QLKH2 từ HTML gốc.

Ví dụ:
  python build_modules.py --check --module qlkh
  python build_modules.py --write --module qlkh
  python build_modules.py --check --all

Mặc định (không tham số) vẫn build Chi tiêu như script cũ.
Chỉ dùng thư viện chuẩn Python, không đọc hoặc ghi dữ liệu khách hàng/Firebase.
"""
import argparse
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODULES = {
    "qlkh": {
        "source": "src/qlkh.html",
        "files": ["modules/qlkh.data.js", "modules/qlkh.v1000.data.js"],
        "global": "QLKH_CHUNKS",
    },
    "chitieu": {
        "source": "src/chitieu.html",
        "files": ["modules/chitieu.data.js"],
        "global": "CHITIEU_CHUNKS",
    },
}


def file_bytes(module):
    cfg = MODULES[module]
    return (ROOT / cfg["source"]).read_bytes()


def make_module(module, raw):
    cfg = MODULES[module]
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    encoded = base64.b64encode(compressed).decode("ascii")
    chunks = [encoded[i:i + 80000] for i in range(0, len(encoded), 80000)]
    return (
        "/* Module {name} - generated from {source}.\n"
        " * Raw size: {raw_len} bytes | Gzip: {zip_len} bytes\n"
        " */\nwindow.{global_name} = {chunks};\n"
    ).format(
        name=module.upper(), source=cfg["source"], raw_len=len(raw),
        zip_len=len(compressed), global_name=cfg["global"],
        chunks=json.dumps(chunks, ensure_ascii=True, indent=2),
    )


def unpack_module(path, global_name):
    content = path.read_text(encoding="utf-8")
    match = re.search(
        r"window\." + re.escape(global_name) + r"\s*=\s*(\[[\s\S]*?\])\s*;",
        content,
    )
    if not match:
        raise ValueError(f"Missing JS chunk declaration: {path}")
    chunks = json.loads(match.group(1))
    if not isinstance(chunks, list) or not chunks or not all(isinstance(c, str) for c in chunks):
        raise ValueError(f"Invalid chunks: {path}")
    return gzip.decompress(base64.b64decode("".join(chunks), validate=True))


def index_raw_bytes(module):
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    match = re.search(r"(?m)^\s*" + re.escape(module) + r":\s*\{([\s\S]*?)\n\s*\}", index)
    if not match:
        raise ValueError(f"Module metadata not found in index: {module}")
    raw_match = re.search(r"rawBytes:\s*(\d+)", match.group(1))
    if not raw_match:
        raise ValueError(f"rawBytes missing from index for {module}")
    return int(raw_match.group(1))


def refresh_index_metadata(module, raw):
    path = ROOT / "index.html"
    original = path.read_text(encoding="utf-8")
    pattern = re.compile(
        r"(?m)^(\s*" + re.escape(module) + r":\s*\{)([\s\S]*?)(\n\s*\})"
    )
    match = pattern.search(original)
    if not match:
        raise ValueError(f"Cannot find module config in index: {module}")
    cfg = MODULES[module]
    block = match.group(2)
    if not re.search(r"rawBytes:\s*\d+", block):
        raise ValueError("Missing rawBytes in module configuration")
    block = re.sub(r"(rawBytes:\s*)\d+", lambda m: m.group(1) + str(len(raw)), block, count=1)
    version = hashlib.sha256(raw).hexdigest()[:12]
    for filename in cfg["files"]:
        file_basename = Path(filename).name
        # Bump cache only for the module being built; leave other tools unchanged.
        block = re.sub(
            r"(" + re.escape(file_basename) + r")\?[^\"']+",
            lambda m: m.group(1) + "?build=" + version,
            block,
        )
    rewritten = original[:match.start(2)] + block + original[match.end(2):]
    if rewritten != original:
        path.write_text(rewritten, encoding="utf-8")
    return version


def verify(module):
    cfg = MODULES[module]
    raw = file_bytes(module)
    errors = []
    for item in cfg["files"]:
        path = ROOT / item
        try:
            found = unpack_module(path, cfg["global"])
            if found != raw:
                errors.append(f"{item}: gzip content DOES NOT MATCH {cfg['source']}")
        except (OSError, ValueError, EOFError, json.JSONDecodeError) as exc:
            errors.append(f"{item}: {exc}")
    try:
        index_size = index_raw_bytes(module)
        if index_size != len(raw):
            errors.append(f"index.html rawBytes={index_size} but {cfg['source']}={len(raw)}")
    except (OSError, ValueError) as exc:
        errors.append(str(exc))
    if errors:
        for error in errors:
            print("[FAIL]", error)
        return False
    print(f"[OK] {module}: source, {len(cfg['files'])} module(s), and index rawBytes match ({len(raw)} bytes)")
    return True


def build(module):
    raw = file_bytes(module)
    packed = make_module(module, raw)
    for item in MODULES[module]["files"]:
        path = ROOT / item
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(packed, encoding="utf-8")
        print("[WRITE]", item)
    version = refresh_index_metadata(module, raw)
    print(f"[CACHE] {module}: {version}")
    return verify(module)


def main():
    parser = argparse.ArgumentParser(description="QLKH2 static module build and integrity check")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Only validate, never modify files")
    mode.add_argument("--write", action="store_true", help="Rebuild modules and bump index cache")
    choice = parser.add_mutually_exclusive_group()
    choice.add_argument("--module", choices=sorted(MODULES), default="chitieu")
    choice.add_argument("--all", action="store_true", help="Check or build all source-backed modules")
    args = parser.parse_args()
    targets = list(MODULES) if args.all else [args.module]
    run = verify if args.check else build  # backward-compatible default
    success = all(run(name) for name in targets)
    raise SystemExit(0 if success else 1)


if __name__ == "__main__":
    main()
