#!/bin/bash
# ============================================
# RFID Speed Monitor — 3-site setup for Kali
# Usage:
#   bash setup.sh           (normal install / re-run safe)
#   bash setup.sh --reset   (WIPE db + user + webroot, then install)
# ============================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESET=0
if [ "$1" == "--reset" ]; then RESET=1; fi
echo "==> Project dir: $PROJECT_DIR   (reset=$RESET)"

# ---- [0/7] Kali fixes: ForceIPv4 ----
echo "==> [0/7] Forcing IPv4 for apt (Kali mirror fix)..."
echo 'Acquire::ForceIPv4 "true";' | sudo tee /etc/apt/apt.conf.d/99force-ipv4 >/dev/null

# ---- [1/7] Packages ----
echo "==> [1/7] Installing apache2, php, MariaDB..."
sudo apt update -qq
sudo apt install -y apache2 php php-mysql libapache2-mod-php php-json php-mbstring \
                    mariadb-server mariadb-client

# ---- [2/7] Services ----
echo "==> [2/7] Enabling + starting services (apache2, mariadb)..."
sudo systemctl enable --now apache2
sudo systemctl enable --now mariadb

# ---- [3/7] Optional reset ----
if [ "$RESET" == "1" ]; then
    echo "==> [3/7] RESET requested: dropping DB + user + webroot..."
    sudo mariadb <<'EOF'
DROP DATABASE IF EXISTS rfid_system;
DROP USER IF EXISTS 'rfid_user'@'localhost';
FLUSH PRIVILEGES;
EOF
    sudo rm -rf /var/www/html/tech /var/www/html/gov /var/www/html/user /var/www/html/index.html
else
    echo "==> [3/7] No reset (safe re-run)."
fi

# ---- [4/7] DB + user ----
echo "==> [4/7] Creating database + user (idempotent)..."
sudo mariadb <<'EOF'
CREATE DATABASE IF NOT EXISTS rfid_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'rfid_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON rfid_system.* TO 'rfid_user'@'localhost';
FLUSH PRIVILEGES;
EOF

# ---- [5/7] Schema + data (both idempotent) ----
echo "==> [5/7] Importing schema + dummy data (idempotent)..."
sudo mariadb rfid_system < "$PROJECT_DIR/sql/optionA.sql"
sudo mariadb rfid_system < "$PROJECT_DIR/sql/dummy_data.sql"

# ---- [6/7] Deploy ----
echo "==> [6/7] Deploying sites to /var/www/html/ ..."
sudo rm -rf /var/www/html/tech /var/www/html/gov /var/www/html/user
sudo cp -r "$PROJECT_DIR/tech" "$PROJECT_DIR/gov" "$PROJECT_DIR/user" /var/www/html/
sudo cp "$PROJECT_DIR/index.html" /var/www/html/index.html
sudo chown -R www-data:www-data /var/www/html/
sudo chmod -R 755 /var/www/html/
sudo systemctl restart apache2

# ---- [7/7] Verify ----
echo "==> [7/7] Verifying DB counts..."
sudo mariadb rfid_system -e "
SELECT 'tags' AS t, COUNT(*) c FROM tags
UNION ALL SELECT 'zones', COUNT(*) FROM speed_zones
UNION ALL SELECT 'devices', COUNT(*) FROM edge_devices
UNION ALL SELECT 'readings', COUNT(*) FROM live_readings
UNION ALL SELECT 'violations', COUNT(*) FROM violations
UNION ALL SELECT 'gov_reports', COUNT(*) FROM government_report;"

echo ""
echo "=============================================="
echo "  ✅ DONE — 3 sites are live:"
echo "     http://localhost/tech/"
echo "     http://localhost/gov/"
echo "     http://localhost/user/"
echo "     http://localhost/        (chooser)"
echo ""
echo "  Test APIs:"
echo "     curl http://localhost/tech/api/devices.php"
echo "     curl http://localhost/gov/api/zones.php"
echo "     curl 'http://localhost/gov/api/tag_search.php?tag_id=E2801160600002055B4C7D3A'"
echo "=============================================="
