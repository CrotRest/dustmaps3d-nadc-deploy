#!/bin/sh
# Delete images the backend generated more than 24 hours ago. The website shows each image
# right after it is made and never saves it, so nothing refers to old files.
# Run hourly from cron as the service user, e.g. /etc/cron.d/dustmaps3d:
#   17 * * * * dustmaps /opt/dustmaps3d/deploy/cleanup-results.sh
set -eu
RESULTS_DIR="${1:-/opt/dustmaps3d/backend/var/results}"
[ -d "$RESULTS_DIR" ] || exit 0
find "$RESULTS_DIR" -maxdepth 1 -type f -name '*.png' -mmin +1440 -delete
