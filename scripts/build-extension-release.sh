#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXTENSION_DIR="${REPO_ROOT}/browser-extension"
DIST_DIR="${REPO_ROOT}/dist"
MANIFEST_PATH="${EXTENSION_DIR}/manifest.json"

if [[ ! -d "${EXTENSION_DIR}" ]]; then
  fail "Extension directory not found: ${EXTENSION_DIR}"
fi

if [[ ! -f "${MANIFEST_PATH}" ]]; then
  fail "manifest.json not found at: ${MANIFEST_PATH}"
fi

if ! command -v node >/dev/null 2>&1; then
  fail "node is required but not found in PATH."
fi

if ! command -v zip >/dev/null 2>&1; then
  fail "zip is required but not found in PATH."
fi

VERSION="$(
  node -e '
    const fs = require("fs");
    const manifestPath = process.argv[1];
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (!manifest.version) {
      process.exit(2);
    }
    process.stdout.write(manifest.version);
  ' "${MANIFEST_PATH}"
)"

if [[ -z "${VERSION}" ]]; then
  fail "Could not read extension version from manifest.json"
fi

mkdir -p "${DIST_DIR}"
ZIP_PATH="${DIST_DIR}/dsg-extension-v${VERSION}-root.zip"
rm -f "${ZIP_PATH}"

(
  cd "${EXTENSION_DIR}"
  zip -qr "${ZIP_PATH}" .
)

python3 - <<'PY' "${ZIP_PATH}"
import sys
import zipfile

zip_path = sys.argv[1]
with zipfile.ZipFile(zip_path, "r") as archive:
    names = archive.namelist()
    if "manifest.json" not in names:
        raise SystemExit("ERROR: ZIP is invalid. manifest.json is missing at ZIP root.")
PY

if command -v sha256sum >/dev/null 2>&1; then
  SHA256="$(sha256sum "${ZIP_PATH}" | awk '{print $1}')"
else
  SHA256="sha256 unavailable"
fi

echo "Extension package created successfully."
echo "Version: ${VERSION}"
echo "ZIP: ${ZIP_PATH}"
echo "SHA256: ${SHA256}"
