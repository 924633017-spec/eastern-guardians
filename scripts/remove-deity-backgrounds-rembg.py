from pathlib import Path
from rembg import remove

ROOT = Path("/Users/apple/Documents/New project555")
PUBLIC = ROOT / "public" / "deities"
FILES = ["guanyin", "caishen", "mazu", "yuelao", "wenchang"]

for name in FILES:
    path = PUBLIC / f"{name}.png"
    source = path.read_bytes()
    output = remove(source)
    path.write_bytes(output)
    print(f"Processed {path}")
