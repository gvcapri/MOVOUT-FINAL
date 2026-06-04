#!/bin/bash
cd Backend || exit 1
[ -d .venv ] || python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
[ -f isrgrootx1.pem ] || curl -o isrgrootx1.pem https://letsencrypt.org/certs/isrgrootx1.pem
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Configure Backend/.env antes de rodar novamente."
  exit 1
fi
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
