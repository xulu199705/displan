#!/usr/bin/env bash
set -Eeuo pipefail
as_root() {
    if [[ "$EUID" -eq 0 ]]; then "$@"; else sudo "$@"; fi
}
status() {
    systemctl show nginx -p ActiveState -p SubState -p MainPID -p UnitFileState
    curl --silent --connect-timeout 2 --max-time 5 -o /dev/null -w 'Root HTTP: %{http_code}\n' http://192.168.30.141/ || true
}
case "$*" in
    start|restart)
        as_root nginx -t
        as_root systemctl "$1" nginx
        ready=false
        for attempt in {1..40}; do
            if curl --silent --fail --connect-timeout 1 --max-time 2 http://192.168.30.141/ -o /dev/null; then ready=true; break; fi
            sleep 0.2
        done
        [[ "$ready" == true ]] || { echo "FAIL: Nginx HTTP did not become ready"; exit 1; }
        status
        ;;
    stop) as_root systemctl stop nginx; status ;;
    status) status ;;
    *) echo "Usage: $0 {start|stop|restart|status}" >&2; exit 2 ;;
esac
