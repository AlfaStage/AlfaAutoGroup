#!/usr/bin/env bash
# Prepara uma VM Oracle Cloud (Ubuntu 22.04/24.04) para rodar o stack.
# Uso: sudo bash bootstrap-server.sh
set -euo pipefail

echo ">> Atualizando sistema..."
apt-get update -y && apt-get upgrade -y

echo ">> Instalando Docker..."
apt-get install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker "${SUDO_USER:-ubuntu}"

echo ">> Criando swap de 4G (evita OOM no build do Next.js)..."
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ">> Liberando 80/443 no firewall local da Oracle (iptables vem fechado)..."
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save || (apt-get install -y iptables-persistent && netfilter-persistent save)

echo ">> Pronto. Faça logout/login para o grupo docker valer."
