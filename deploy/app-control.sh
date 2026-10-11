#!/usr/bin/env bash
set -Eeuo pipefail
unit="$1"
url="$2"
action="$3"
status() {
    echo "Service: $unit"
    echo "URL: $url"
    systemctl --user show "$unit" -p ActiveState -p SubState -p MainPID -p UnitFileState
    curl --silent --show-error --connect-timeout 2 --max-time 5 -o /dev/null -w 'HTTP: %{http_code}\n' "$url" || true
}
case "$action" in
    start|stop|restart)
        systemctl --user "$action" "$unit"
        status
        ;;
    status) status ;;
    *) echo "Usage: {start|stop|restart|status}" >&2; exit 2 ;;
esac
