#!/usr/bin/env bash
set -Eeuo pipefail
as_root() {
    if [[ "$EUID" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}
status() {
    systemctl show nginx -p ActiveState -p SubState -p MainPID -p UnitFileState
    curl --silent --show-error --connect-timeout 2 --max-time 5 -o /dev/null -w 'Root HTTP: %{http_code}\n' http://192.168.30.141/ || true
}
case "$*" in
    start|restart)
        as_root nginx -t
        as_root systemctl "$1" nginx
        status
        ;;
    stop) as_root systemctl stop nginx; status ;;
    status) status ;;
    *) echo "Usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
