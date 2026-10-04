# P006 Factory Package Roundtrip 1.0

Entry: Composer document toolbar → 공장 패키지 ZIP.

Export snapshots the current Layout, analysis, coordinate, review states, equipment catalog, and accessible same-origin resource URLs. Binary resources are stored under SHA-256 names; manifest retains source URL mappings. Absent image/analysis/catalog and unresolved external dependencies are explicitly reported. No Layout or DB mutation is performed.

Import validates format version, mandatory paths, byte sizes, SHA-256, resource references, coordinate consistency, data shape, safe archive paths, and archive size (200 MiB) before exposing the preview. It does not fetch URLs from imported JSON, execute archive scripts, or install the imported Layout. Re-download preserves the original validated ZIP bytes.

Preview contains original image, analysis JSON, review states, file count, Layout instance count and missing resources. Import does not claim image detection accuracy or full offline rendering readiness. USD/GLTF transitive dependencies remain explicitly pending verification.

QA: three image fixtures run through production analyzeImage with Pillow-decoded RGBA input (not browser canvas), packaged and reloaded with the production package functions. Image bytes, analysis JSON, Layout and SHA hashes compared. Five negative cases: hash corruption, missing file, unsupported version, unsafe path, unlisted file. Browser Preview tested separately in devPreview mode; authenticated catalog returns 401.

Next: authenticated operational Layout package test; complete transitive resource collection before claiming portable offline 3D restoration.
