# Qwen3.8 27B local Kilo agent

- Runtime: existing CUDA-enabled `llama-server`, bound only to `127.0.0.1:24038`.
- Model: `unsloth/Qwen3.8-27B-GGUF`, `Qwen3.8-27B-UD-Q4_K_M.gguf` (16.46 GB).
- Kilo uses a separate user-global config at `~/.config/kilo-qwen38/kilo/kilo.jsonc`; it never places a secret in a project config.
- Invoke: `cd /opt/Resonance && qwen38-kilo`.
- Health: `systemctl status resonance-qwen38-local`; API is private and requires its API key.

The service does not expose a public port, does not replace the existing Gemma or Omniverse process, and restarts after a process failure. `QWEN38_CONTEXT=8192` intentionally limits KV-cache VRAM while Kit is running.
