# PostgreSQL backup key recovery

The offsite PostgreSQL backup is encrypted with a random 64-byte master key.
The Windows working copy is protected by DPAPI. A second copy is held as the
write-only GitHub Actions secret `RESONANCE_BACKUP_MASTER_KEY_B64`.

The raw key must never be committed, printed, attached to an issue, or copied
into a workflow input.

## Emergency recovery

1. Create a temporary RSA 4096-bit key pair on the recovery workstation.
2. Base64-encode only the public PEM.
3. Run the `Backup key emergency rewrap` workflow with the public key and an
   approved recovery ticket.
4. Download the one-day artifact.
5. Decrypt `backup-master-key.rsa-oaep-sha256.enc` with the temporary private
   key and verify SHA-256 fingerprint
   `7018d4223215c98b76bb64d445d65d2c15fecbb9a362391acaa8e831da4e36f8`.
6. Import the recovered 64-byte key on the isolated recovery workstation and
   run `Restore-ResonancePostgresBackup.ps1`.
7. Destroy the temporary private key and recovered plaintext key after the
   restore evidence is recorded.

The workflow uses the protected `backup-key-recovery` environment so repository
administrators can require reviewer approval before the secret is rewrapped.
