import os
import sys
import gzip
import base64
import json

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.join(BASE_DIR, "src")
MODULES_DIR = os.path.join(BASE_DIR, "modules")

def build_module(name, src_filename, output_filename, global_name, chunk_size=80000):
    src_path = os.path.join(SRC_DIR, src_filename)
    out_path = os.path.join(MODULES_DIR, output_filename)

    if not os.path.exists(src_path):
        print(f"[-] Không tìm thấy file nguồn: {src_path}")
        return False

    with open(src_path, 'rb') as f:
        raw_bytes = f.read()

    # Nén gzip mức tối đa 9
    compressed = gzip.compress(raw_bytes, compresslevel=9)
    b64_str = base64.b64encode(compressed).decode('ascii')

    # Chia thành các chunks
    chunks = []
    for i in range(0, len(b64_str), chunk_size):
        chunks.append(b64_str[i:i+chunk_size])

    chunks_json = json.dumps(chunks, indent=2)
    js_content = f"""/* Dữ liệu gzip/Base64 của module {name.upper()}.
 * Build tự động từ src/{src_filename}.
 * Raw size: {len(raw_bytes):,} bytes | Compressed: {len(compressed):,} bytes
 */
window.{global_name} = {chunks_json};
"""

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    # Kiểm tra lại giải nén
    check_b64 = "".join(chunks)
    check_raw = gzip.decompress(base64.b64decode(check_b64))
    assert check_raw == raw_bytes, "Lỗi kiểm tra tính toàn vẹn giải nén!"

    ratio = (len(compressed) / len(raw_bytes)) * 100
    print(f"[V] Build thành công: {output_filename}")
    print(f"    Raw: {len(raw_bytes):,} bytes -> Gzip: {len(compressed):,} bytes ({ratio:.1f}%)")
    print(f"    Chunks: {len(chunks)} chunks -> {out_path}")
    return True

if __name__ == '__main__':
    print("=" * 50)
    print("🚀 BẮT ĐẦU ĐÓNG GÓI MODULES QLKH")
    print("=" * 50)
    build_module(
        name="CHITIEU",
        src_filename="chitieu.html",
        output_filename="chitieu.data.js",
        global_name="CHITIEU_CHUNKS"
    )
    print("=" * 50)
    print("Hoàn tất!")
