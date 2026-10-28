"""Check that every packaged web byte matches the current production build."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser()
parser.add_argument("--dist", type=Path, default=Path("dist"))
parser.add_argument("--apk", type=Path, action="append", default=[])
parser.add_argument("--aab", type=Path, action="append", default=[])
args = parser.parse_args()
expected = {
    path.relative_to(args.dist).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
    for path in args.dist.rglob("*") if path.is_file()
}
assert expected and "index.html" in expected, "Missing production build"
reports = []
for package, prefix, dex_prefix in [
    *((p, "assets/public/", "classes") for p in args.apk),
    *((p, "base/assets/public/", "base/dex/classes") for p in args.aab),
]:
    with ZipFile(package) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)), f"Duplicate ZIP entries: {package}"
        web = {name[len(prefix):]: name for name in names if name.startswith(prefix) and not name.endswith("/")}
        for name, digest in expected.items():
            assert name in web, f"Missing web file: {package}: {name}"
            assert hashlib.sha256(archive.read(web[name])).hexdigest() == digest, f"Stale web file: {package}: {name}"
        extra = set(web) - expected.keys()
        assert extra <= {"cordova.js", "cordova_plugins.js"}, f"Unexpected web assets: {package}: {extra}"
        for name in extra:
            assert not archive.read(web[name]).strip(), f"Unexpected Cordova payload: {name}"
        dex = [name for name in names if name.startswith(dex_prefix) and name.endswith(".dex")]
        assert any(b"Lcom/fincansokagi/game/DeviceThermalPlugin;" in archive.read(name) for name in dex), f"Missing native thermal bridge: {package}"
        reports.append({"package": str(package), "webFilesMatch": len(expected), "nativeThermalBridge": True,
                        "bytes": package.stat().st_size, "sha256": hashlib.sha256(package.read_bytes()).hexdigest()})
assert reports, "Pass at least one --apk or --aab"
print(json.dumps(reports, indent=2))
