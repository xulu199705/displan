#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "Run with sudo"; exit 1; }
cd /home/xulu/Service/displan/deploy
sha256sum -c SHA256SUMS-subpath
backup="/var/backups/tnc-services/$(date +%Y%m%dT%H%M%S)"
install -d -m 0755 "$backup" /var/www/tnc-services
cp -a /etc/nginx/conf.d/displan.conf "$backup/displan.conf"
install -m 0644 tnc30141.conf /etc/nginx/conf.d/displan.conf
install -m 0644 index.html /var/www/tnc-services/index.html
restorecon -RF /var/www/tnc-services /etc/nginx/conf.d/displan.conf
if ! nginx -t; then
    cp -a "$backup/displan.conf" /etc/nginx/conf.d/displan.conf
    echo "Config restored; validation failed"
    exit 1
fi
# Required by SELinux for Nginx to proxy to the two application ports.
setsebool -P httpd_can_network_connect on
loginctl enable-linger xulu
systemctl enable nginx
if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl start nginx; fi
echo "Backup: $backup"
bash ./verify-services.sh
