#!/bin/bash
# ============================================
# BLACKWOLF ENJAMBRE - DEPLOY EN UBUNTU
# ============================================
set -e

echo "========================================="
echo " BLACKWOLF ENJAMBRE - INSTALACIÓN"
echo "========================================="

# 1. Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "[+] Instalando Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "[!] Reinicia la sesión para aplicar permisos de Docker"
fi

if ! command -v docker compose &> /dev/null; then
    echo "[+] Instalando Docker Compose plugin..."
    sudo apt-get install -y docker-compose-plugin
fi

# 2. Crear .env si no existe
if [ ! -f .env ]; then
    echo "[+] Creando .env desde .env.example..."
    cp .env.example .env
    # Generar JWT secret
    JWT=$(openssl rand -hex 32)
    sed -i "s/genera_un_secret_de_64_caracteres_minimo_aqui/$JWT/" .env
    echo "[!] EDITA el archivo .env con tus valores reales antes de continuar"
    echo "    nano .env"
    exit 1
fi

# 3. Crear directorios necesarios
mkdir -p nginx/ssl

# 4. Build y arrancar
echo "[+] Construyendo imágenes..."
docker compose build

echo "[+] Arrancando servicios..."
docker compose up -d

# 5. Esperar a que PostgreSQL esté listo
echo "[+] Esperando a PostgreSQL..."
until docker compose exec -T postgres pg_isready -U enjambre; do
    sleep 2
done

echo ""
echo "========================================="
echo " ENJAMBRE ACTIVO"
echo "========================================="
echo ""
echo " Dashboard:  http://localhost:3600"
echo " API:        http://localhost:3500"
echo " Health:     http://localhost:3500/health"
echo ""
echo " Siguiente paso: configurar Cloudflare Tunnel"
echo "   cloudflared tunnel create enjambre"
echo "   cloudflared tunnel route dns enjambre comando.tudominio.com"
echo "   cloudflared tunnel route dns enjambre api.tudominio.com"
echo "   cloudflared tunnel route dns enjambre forms.tudominio.com"
echo "   cloudflared tunnel route dns enjambre soc.tudominio.com"
echo ""
echo " Para ver logs:"
echo "   docker compose logs -f enjambre-api"
echo ""
