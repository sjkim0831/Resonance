#!/usr/bin/env bash
set -eu
ref=127.0.0.1:5000/spilo-16-uid1000:3.2-p3
archive=/tmp/spilo-16-uid1000.tar
ctr_bin=$(command -v ctr)
sudo "$ctr_bin" -n k8s.io images export --platform linux/amd64 "$archive" "$ref"
docker load -i "$archive"
sudo rm -f "$archive"
docker image inspect "$ref" --format '{{.RepoTags}}'
