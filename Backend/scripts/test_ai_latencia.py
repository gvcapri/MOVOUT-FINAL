import requests
import time
import os

URL = "https://skaarf77-pec1.hf.space/detectar"
print(f"--- Testando POST REAL na IA em {URL} ---")

dummy_file = "diag.jpg"
with open(dummy_file, "wb") as f:
    f.write(b"\xFF\xD8\xFF\xD9") # Dummy tiny JPG

try:
    start = time.time()
    with open(dummy_file, "rb") as f:
        files = {"file": f}
        # Adicionando headers de navegador
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.post(URL, files=files, headers=headers, timeout=60)
    duration = time.time() - start
    print(f"Status Code: {response.status_code}")
    print(f"Resposta: {response.text}")
    print(f"Tempo total: {duration:.2f}s")
except Exception as e:
    print(f"❌ Erro ao conectar: {e}")
finally:
    if os.path.exists(dummy_file):
        os.remove(dummy_file)

