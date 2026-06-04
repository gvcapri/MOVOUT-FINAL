#!/bin/bash
./scripts/atualizar_ip.sh
cd "Frontend Motorista" || exit 1
npm install
npx expo start -c
