#!/usr/bin/env bash
# Mirrors a staged site directory to the web host over FTP(S) with lftp.
#
#   deploy/upload.sh <staged-dir>
#
# Required env:  FTP_HOST  FTP_USERNAME  FTP_PASSWORD
# Optional env:  FTP_PORT (21)  FTP_REMOTE_DIR (/)  FTP_TLS (1 = require explicit FTPS, 0 = plain FTP)
#                FTP_VERIFY_CERT (yes|no, default yes)
#
# Remote files that are not in the staged dir are deleted, so removed pages disappear from the site --
# except cPanel's own .well-known/ (SSL validation) and cgi-bin/ and error_log, which are never touched.
set -euo pipefail

SRC="${1:?usage: upload.sh <staged-dir>}"
: "${FTP_HOST:?FTP_HOST not set}" "${FTP_USERNAME:?FTP_USERNAME not set}" "${FTP_PASSWORD:?FTP_PASSWORD not set}"
PORT="${FTP_PORT:-21}"
REMOTE_DIR="${FTP_REMOTE_DIR:-/}"
TLS="${FTP_TLS:-1}"
VERIFY="${FTP_VERIFY_CERT:-yes}"

[ -f "$SRC/index.html" ] || { echo "upload: $SRC/index.html missing -- not a staged site, refusing to upload." >&2; exit 1; }

SETTINGS="set cmd:fail-exit yes; set net:max-retries 5; set net:reconnect-interval-base 5; set net:timeout 30; set ftp:passive-mode yes; set mirror:parallel-transfer-count 4;"
if [ "$TLS" = "1" ]; then
  SETTINGS="$SETTINGS set ftp:ssl-force true; set ftp:ssl-protect-data true; set ftp:ssl-auth TLS; set ssl:verify-certificate $VERIFY;"
else
  SETTINGS="$SETTINGS set ftp:ssl-allow no;"
fi

lftp -p "$PORT" -u "$FTP_USERNAME,$FTP_PASSWORD" -e "$SETTINGS \
  mirror --reverse --delete --verbose=1 --parallel=4 \
    --exclude '^\.well-known/' --exclude '^cgi-bin/' --exclude '^error_log\$' \
    '$SRC' '$REMOTE_DIR'; \
  bye" "$FTP_HOST"
echo "upload: done."
