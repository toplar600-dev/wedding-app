import subprocess
import webbrowser
import time
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("  Nicat & Liana - Toy Tetbiqi")
print("=" * 50)
print()
print("  Server basladilir...")
print()

process = subprocess.Popen(
    ["node", "server.js"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding="utf-8",
    errors="replace"
)

time.sleep(2)

url = "http://localhost:3000"
print(f"  Brauzer acilir: {url}")
print()
print("  Sehifeler:")
print(f"    Ana Sehife:   {url}")
print(f"    Yukleme:      {url}/upload.html")
print(f"    Admin Panel:  {url}/admin.html")
print(f"    Sifre:        nicatliana2024")
print()
print("  Gurcustan toyu: 14 Iyun 2026")
print("  Turkiye toyu:   21 Iyun 2026")
print()
print("  Baglamaq ucun bu pencereni baglayin ve ya Ctrl+C basin.")
print("=" * 50)

webbrowser.open(url)

try:
    process.wait()
except KeyboardInterrupt:
    print("\n  Server baglanir...")
    process.terminate()
    sys.exit(0)
