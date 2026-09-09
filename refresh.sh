#!/bin/zsh
# Refresh The Vault and publish it.
#
# Runs sync.mjs, and pushes only if the listings actually changed. GitHub Pages
# redeploys from the push, so this is the whole pipeline.
#
# It lives on this Mac rather than in a scheduled cloud agent because the cloud
# sandbox's egress proxy refuses marktplaats.nl and vinted.com outright: direct
# curl there gets "403 CONNECT tunnel failed" from the network policy, so every
# scheduled run failed for weeks while the page quietly kept showing July. From
# here, on a normal connection, the same requests answer 200.

set -uo pipefail

REPO="$HOME/vintage-toy-vault"
LOG="$HOME/Library/Logs/vintage-toy-vault.log"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

say() { print -r -- "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG" }

cd "$REPO" || { say "FAIL: no repo at $REPO"; exit 1 }

say "--- refresh start ---"

if ! out=$(node sync.mjs 2>&1); then
  say "FAIL: sync.mjs did not complete"
  print -r -- "$out" | sed 's/^/    /' >> "$LOG"
  exit 1
fi
print -r -- "$out" | sed 's/^/    /' >> "$LOG"

# Nothing new on Marktplaats is a normal morning, not a failure. Committing an
# identical file every day would bury the real changes in the history.
if git diff --quiet -- index.html; then
  say "no change, nothing pushed"
  say "--- refresh done ---"
  exit 0
fi

count=$(grep -c '^    { brand:' index.html)
git add index.html
if ! git commit -q -m "Vault refresh: $count listings" 2>>"$LOG"; then
  say "FAIL: commit"; exit 1
fi
if ! git push -q origin main 2>>"$LOG"; then
  say "FAIL: push. The commit is local, so the next run will carry it."
  exit 1
fi

say "pushed: $count listings"
say "--- refresh done ---"
