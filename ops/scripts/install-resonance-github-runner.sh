#!/usr/bin/env bash
set -euo pipefail

repository="${GITHUB_RUNNER_REPOSITORY:-sjkim0831/Resonance}"
runner_root="${GITHUB_RUNNER_ROOT:-/opt/resonance-data/github-runner}"
runner_user="${GITHUB_RUNNER_USER:-sjkim}"
runner_name="${GITHUB_RUNNER_NAME:-resonance-172-16-1-232}"
runner_labels="${GITHUB_RUNNER_LABELS:-resonance-deploy}"
registration_token="${GITHUB_RUNNER_REGISTRATION_TOKEN:-}"

[[ -n "$registration_token" ]] || {
  echo "[github-runner] registration token is required" >&2
  exit 2
}
[[ "$runner_root" == /opt/resonance-data/* ]] || {
  echo "[github-runner] refusing non-persistent runner root: $runner_root" >&2
  exit 3
}

release_json="$(curl -fsSL --max-time 20 \
  https://api.github.com/repos/actions/runner/releases/latest)"
runner_version="$(jq -r '.tag_name | ltrimstr("v")' <<<"$release_json")"
asset_url="$(jq -r '
  .assets[]
  | select(.name | test("^actions-runner-linux-x64-[0-9.]+\\.tar\\.gz$"))
  | .browser_download_url
' <<<"$release_json" | head -n 1)"
[[ -n "$runner_version" && -n "$asset_url" ]] || {
  echo "[github-runner] latest Linux x64 release was not found" >&2
  exit 4
}

sudo -n install -d -m 0750 -o "$runner_user" -g "$runner_user" "$runner_root"
current_version="$(cat "$runner_root/.runner-version" 2>/dev/null || true)"
if [[ "$current_version" != "$runner_version" || ! -x "$runner_root/bin/Runner.Listener" ]]; then
  archive="$(mktemp /tmp/actions-runner.XXXXXX.tar.gz)"
  trap 'rm -f "$archive"' EXIT
  curl -fsSL --retry 3 --max-time 180 "$asset_url" -o "$archive"
  sudo -n find "$runner_root" -mindepth 1 -maxdepth 1 \
    ! -name _work ! -name .credentials ! -name .credentials_rsaparams \
    -exec rm -rf -- {} +
  sudo -n tar -xzf "$archive" -C "$runner_root"
  printf '%s\n' "$runner_version" |
    sudo -n tee "$runner_root/.runner-version" >/dev/null
  sudo -n chown -R "$runner_user:$runner_user" "$runner_root"
fi

if ! sudo -n test -s "$runner_root/.runner"; then
  sudo -n -u "$runner_user" bash -c "
    cd '$runner_root'
    ./config.sh --unattended --replace \
      --url 'https://github.com/$repository' \
      --token '$registration_token' \
      --name '$runner_name' \
      --labels '$runner_labels' \
      --work _work
  "
fi
service_name="$(sudo -n cat "$runner_root/.service" 2>/dev/null || true)"
if [[ -z "$service_name" || ! -f "/etc/systemd/system/$service_name" ]]; then
  sudo -n "$runner_root/svc.sh" install "$runner_user" >/dev/null
fi
sudo -n "$runner_root/svc.sh" start >/dev/null

service_name="$(cat "$runner_root/.service")"
sudo -n systemctl is-active --quiet "$service_name"

sudo -n install -m 0644 \
  "$(
    cd "$(dirname "${BASH_SOURCE[0]}")/../systemd"
    pwd
  )/carbonet-auto-deploy.timer" \
  /etc/systemd/system/carbonet-auto-deploy.timer
sudo -n systemctl daemon-reload
sudo -n systemctl enable --now carbonet-auto-deploy.timer >/dev/null
sudo -n systemctl restart carbonet-auto-deploy.timer
echo "[github-runner] PASS version=$runner_version service=$service_name repository=$repository labels=$runner_labels"
