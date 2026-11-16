#!/usr/bin/env bash
# Hand-written (design study): build the design-direction prototypes and serve them locally.
#   _port/design/preview.sh [port]      -> http://localhost:4321/design/
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
python3 _port/design/proto/build.py
exec python3 _port/design/preview.py "${1:-4321}"
