# Deploy — AlfaAltoGrup + Evolution GO

Stack: Caddy (HTTPS automático) → Next.js (`web`) + `worker` + Evolution GO + Postgres.

## 1. VM na Oracle Cloud
Crie uma instância **VM.Standard.A1.Flex (ARM Ampere)** com **4 OCPU / 24 GB RAM** —
está no Always Free e é muito superior ao shape micro de 1 CPU / 1 GB.
Imagem: **Canonical Ubuntu 24.04**.

Na *Virtual Cloud Network → Security List*, libere ingress TCP **80** e **443** (0.0.0.0/0).

## 2. Preparar o servidor
```bash
sudo bash deploy/bootstrap-server.sh
```

## 3. DNS
Aponte dois registros **A** para o IP público da VM:
- `painel.seudominio.com.br`
- `api.seudominio.com.br`

## 4. Configurar e subir
```bash
cp deploy/env.prod.example deploy/.env
# preencha os segredos (openssl rand -hex 32)
cd deploy && docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

O Caddy emite os certificados Let's Encrypt sozinho assim que o DNS propagar.

## 5. Conectar o WhatsApp
Painel: `https://painel.seudominio.com.br`
API/Swagger: `https://api.seudominio.com.br`
