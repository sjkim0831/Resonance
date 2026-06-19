#!/bin/bash
# Harden UFW firewall for Carbon Emissions Trading Platform
# Run as: sudo ./ops/scripts/harden-ufw-for-carbon.sh

set -e

echo "[+] Hardening UFW firewall for carbon emissions platform..."

echo "[1] Resetting UFW rules..."
sudo ufw reset

echo "[2] Allowing essential ports..."
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw allow from 172.16.1.231 to any port 24453
sudo ufw allow from 10.244.0.0/16 to any port 33000
sudo ufw allow from 192.168.0.0/16 to any port 33000
sudo ufw allow from 10.0.0.0/8 to any port 33000

echo "[3] Setting default policies..."
sudo ufw default deny incoming
sudo ufw default allow outgoing

echo "[4] Enabling UFW..."
sudo ufw enable

echo "[+] UFW hardened successfully!"
echo "[+] Current status:"
sudo ufw status verbose
