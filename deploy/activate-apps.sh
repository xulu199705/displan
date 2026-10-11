#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(id -un)" == xulu ]] || { echo "Run this as xulu"; exit 1; }
base=/home/xulu/Service/displan
note=/home/xulu/Service/display_plan_note/U-3-A-343432
cd "$base/deploy"
sha256sum -c SHA256SUMS-subpath
revision="$(cat REVISION)"
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid revision"; exit 1; }
release="$base/releases/$revision"
[[ ! -e "$release" ]] || { echo "Release already exists: $release"; exit 1; }
mkdir -p "$release" "$base/backups" "$note/backups" /home/xulu/.config/systemd/user
tar -xzf displan-subpath.tar.gz -C "$release"
backup="$(date +%Y%m%dT%H%M%S)"
for target in "$base" "$note"; do
    mkdir -p "$target/backups/$backup"
    for script in start.sh stop.sh restart.sh status.sh displan.sh install.sh verify-service.sh; do
        if [[ -f "$target/$script" ]]; then cp -a "$target/$script" "$target/backups/$backup/"; fi
    done
done
if [[ -e "$base/current" && ! -L "$base/current" ]]; then echo "current is not a symlink"; exit 1; fi
ln -sfn "$release" "$base/current"
install -m 0644 app-control.sh "$note/deploy/app-control.sh"
for target in "$base" "$note"; do
    if [[ "$target" == "$base" ]]; then
        unit=displan.service
        url=http://192.168.30.141/displan/
    else
        unit=displaynote-u-3-a-343432.service
        url=http://192.168.30.141/display_plan_note/U-3-A-343432/
    fi
    for action in start stop restart status; do
        printf '#!/usr/bin/env bash\nset -Eeuo pipefail\nexec bash "%s/deploy/app-control.sh" "%s" "%s" "%s"\n' "$target" "$unit" "$url" "$action" > "$target/$action.sh"
        chmod 0755 "$target/$action.sh"
    done
done
printf '#!/usr/bin/env bash\nset -Eeuo pipefail\nexec bash /home/xulu/Service/displan/deploy/app-control.sh displan.service http://192.168.30.141/displan/ "$@"\n' > "$base/displan.sh"
chmod 0755 "$base/displan.sh"
install -m 0755 nginx-control.sh /home/xulu/Service/nginx.sh
for action in start stop restart status; do
    printf '#!/usr/bin/env bash\nset -Eeuo pipefail\nexec bash /home/xulu/Service/nginx.sh "%s"\n' "$action" > "/home/xulu/Service/nginx-$action.sh"
    chmod 0755 "/home/xulu/Service/nginx-$action.sh"
done
ln -sfn "$base/deploy/displan.service" /home/xulu/.config/systemd/user/displan.service
ln -sfn "$note/deploy/displaynote-u-3-a-343432.service" /home/xulu/.config/systemd/user/displaynote-u-3-a-343432.service
systemctl --user daemon-reload
systemctl --user enable displan.service displaynote-u-3-a-343432.service
systemctl --user restart displan.service displaynote-u-3-a-343432.service
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:55432/ -o /dev/null
curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:55431/ -o /dev/null
printf '#!/usr/bin/env bash\nset -Eeuo pipefail\nexec bash /home/xulu/Service/displan/deploy/install-nginx.sh "$@"\n' > "$base/install.sh"
printf '#!/usr/bin/env bash\nset -Eeuo pipefail\nexec bash /home/xulu/Service/displan/deploy/verify-services.sh "$@"\n' > "$base/verify-service.sh"
chmod 0755 "$base/install.sh" "$base/verify-service.sh"
cp REVISION "$base/VERSION"
echo "PASS: independent user services ready; run sudo bash $base/install.sh"
