#!/bin/bash
IP=$(hostname -I | awk '{print $1}')
echo "IP detectado: $IP"
sed -i "s/const BASE_IP = '.*';/const BASE_IP = '$IP';/" Frontend/src/api/config.js
sed -i "s/const BASE_IP = '.*';/const BASE_IP = '$IP';/" "Frontend Motorista/src/api/config.js"
echo "Frontends atualizados para $IP"
