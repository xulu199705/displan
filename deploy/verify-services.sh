#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "Run with sudo to verify Nginx controls"; exit 1; }
exec > >(tee /home/xulu/Service/verification-subpaths.log) 2>&1
as_xulu() {
    runuser -u xulu -- env XDG_RUNTIME_DIR=/run/user/1000 DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus "$@"
}
restore() {
    as_xulu systemctl --user start displan.service displaynote-u-3-a-343432.service
    systemctl start nginx
}
trap restore EXIT
http_code() { curl --silent --output /dev/null --connect-timeout 2 --max-time 5 --write-out '%{http_code}' "$1" || true; }
assert_code() {
    actual="$(http_code "$1")"
    [[ "$actual" == "$2" ]] || { echo "FAIL: $1 expected $2 got $actual"; exit 1; }
}
displan=http://192.168.30.141/displan/
note=http://192.168.30.141/display_plan_note/U-3-A-343432/
assert_code http://192.168.30.141/ 200
assert_code http://192.168.30.141/unrelated-path 404
assert_code http://192.168.30.141/displan 301
assert_code http://192.168.30.141/display_plan_note/U-3-A-343432 301
assert_code "$displan" 200
assert_code "$note" 200
assert_code "$displan"assets/missing.js 404
assert_code "$note"assets/missing.png 404
echo "PASS: root portal, scoped redirects, unknown path 404, both routes"
for application in displan note; do
    if [[ "$application" == displan ]]; then
        dir=/home/xulu/Service/displan
        unit=displan.service
        url="$displan"
        other="$note"
    else
        dir=/home/xulu/Service/display_plan_note/U-3-A-343432
        unit=displaynote-u-3-a-343432.service
        url="$note"
        other="$displan"
    fi
    as_xulu bash "$dir/stop.sh"
    assert_code "$url" 502
    assert_code "$other" 200
    systemctl is-active --quiet nginx
    as_xulu bash "$dir/start.sh"
    for attempt in {1..10}; do [[ "$(http_code "$url")" == 200 ]] && break; sleep 0.2; done
    assert_code "$url" 200
    before="$(as_xulu systemctl --user show "$unit" -p MainPID --value)"
    as_xulu bash "$dir/restart.sh"
    after="$(as_xulu systemctl --user show "$unit" -p MainPID --value)"
    [[ "$before" != "$after" && "$after" != 0 ]]
    for attempt in {1..10}; do [[ "$(http_code "$url")" == 200 ]] && break; sleep 0.2; done
    assert_code "$url" 200
    as_xulu bash "$dir/status.sh"
    echo "PASS: $application stop/start/restart/status are independent"
done
/home/xulu/Service/nginx-stop.sh
assert_code http://192.168.30.141/ 000
as_xulu systemctl --user is-active --quiet displan.service
as_xulu systemctl --user is-active --quiet displaynote-u-3-a-343432.service
/home/xulu/Service/nginx-start.sh
before="$(systemctl show nginx -p MainPID --value)"
/home/xulu/Service/nginx-restart.sh
after="$(systemctl show nginx -p MainPID --value)"
[[ "$before" != "$after" && "$after" != 0 ]]
/home/xulu/Service/nginx-status.sh
assert_code "$displan" 200
assert_code "$note" 200
trap - EXIT
echo "PASS: ALL subpath routing and independent control checks; all services running"
