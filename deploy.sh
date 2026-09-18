#!/usr/bin/env bash
# ==============================================================================
# Nebula Workspace v2.5 - Linux VPS Deployment Script
# ==============================================================================
set -euo pipefail

echo "=================================================="
echo "🚀 Iniciando Deploy do Nebula Workspace v2.5..."
echo "=================================================="

# 1. Verificar dependências necessárias (Docker e Docker Compose)
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não encontrado! Por favor, instale o Docker primeiro."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose v2 não encontrado! Por favor, instale o plugin docker-compose."
    exit 1
fi

# 2. Configurar arquivo de ambiente se não existir
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📝 Criando arquivo .env a partir de .env.example..."
        cp .env.example .env
        echo "⚠️  IMPORTANTE: Edite o arquivo .env e defina suas senhas antes de prosseguir!"
    else
        echo "⚠️  Nenhum arquivo .env encontrado. Certifique-se de configurar as variáveis."
    fi
fi

# 3. Criar diretório de dados persistentes para notas e workspace
mkdir -p ./notes ./data

# 4. Parar instâncias anteriores se estiverem rodando
echo "🔄 Parando containers anteriores..."
docker compose down --remove-orphans || true

# 5. Build da imagem com multi-stage cache
echo "🔨 Construindo a imagem Docker..."
docker compose build --pull

# 6. Inicializar em background
echo "🚀 Subindo os containers em modo detached..."
docker compose up -d

# 7. Aguardar inicialização e verificar status
sleep 3
if docker compose ps | grep -q "Up"; then
    echo "=================================================="
    echo "✅ Nebula Workspace v2.5 está rodando com sucesso!"
    echo "🌐 Acesse: http://<IP_DO_SEU_SERVIDOR>:3000"
    echo "=================================================="
else
    echo "⚠️  O container pode estar com problemas. Verifique os logs com:"
    echo "   docker compose logs -f"
fi
