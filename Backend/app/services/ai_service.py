import requests
from fastapi import UploadFile
import logging
import time

logger = logging.getLogger("uvicorn.error")

AI_API_URL = "https://skaarf77-pec1.hf.space/detectar"

def detectar_objeto(file: UploadFile):
    """
    Envia a imagem para a IA. Se demorar mais de 10s, retorna um resultado simulado
    para não travar o teste do usuário.
    """
    start_time = time.time()
    try:
        content = file.file.read()
        file_size_kb = len(content) / 1024
        file.file.seek(0)
        
        logger.info(f"--- [IA SERVICE] Iniciando detecção ---")
        
        headers = {"User-Agent": "Mozilla/5.0"}
        files = {"file": (file.filename, content, file.content_type)}
        
        # Timeout curto de 10 segundos para não deixar o usuário esperando
        try:
            response = requests.post(AI_API_URL, files=files, headers=headers, timeout=10)
            response.raise_for_status()
            resultado_json = response.json()
            
            # Extrai o nome do objeto da chave 'objetos' conforme o formato da API
            objeto_nome = resultado_json.get("objetos", "Objeto não identificado")
            
            logger.info(f"--- [IA SERVICE] Sucesso real em {time.time() - start_time:.2f}s: {objeto_nome} ---")
            return objeto_nome

        except (requests.exceptions.Timeout, requests.exceptions.RequestException) as e:
            logger.warning(f"--- [IA SERVICE] Falha/Timeout na API real. ---")
            return "Não foi possível confirmar o objeto via IA"
            
    except Exception as e:
        logger.error(f"--- [IA SERVICE] Erro Crítico: {str(e)} ---")
        return "IA não confirmou o objeto"

