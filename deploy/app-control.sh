#!/usr/bin/env bash
set -Eeuo pipefail
unit="$1"
url="$2"
action="$3"
status() {
    echo "Service: $unit"
    echo "URL: $url"
    systemctl --user show "$unit" -p ActiveState -p SubState -p MainPID -p UnitFileState
    curl --silent --connect-timeout 2 --max-time 5 -o /dev/null -w 'HTTP: %{http_code}\n' "$url" || true
}
wait_backend() {
    if [[ "$unit" == displan.service ]]; then backend=http://127.0.0.1:55432/; else backend=http://127.0.0.1:55431/; fi
    for attempt in {1..40}; do
        if curl --silent --fail --connect-timeout 1 --max-time 2 "$backend" -o /dev/null; then return; fi
        sleep 0.2
    done
    echo "FAIL: $unit backend did not become ready" >&2
    return 1
}
case "$action" in
    start|stop|restart)
        systemctl --user "$action" "$unit"
        if [[ "$action" != stop ]]; then wait_backend; fi
        status
        ;;
    status) status ;;
    *) echo "Usage: {start|stop|restart|status}" >&2; exit 2 ;;
esac
