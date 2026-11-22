#!/bin/sh
# Wi24rd Mimir installer.
#
# Makes your own copy of Mimir on GitHub, clones it into a folder here, and
# starts the guided setup. Read it before you run it; it is short.
#
#   sh install.sh
#
# It uses three programs you already have: git, the GitHub CLI (gh) and Node.js.
# It installs nothing, needs no administrator rights, and talks to github.com
# only, through gh and git. Everything it creates is yours: one repository on
# your account and one folder in the current directory.
set -eu

TEMPLATE="${MIMIR_TEMPLATE:-wi24rd-com/mimir}"

say() { printf '%s\n' "$*"; }
stop() { printf '\nInstall stopped: %s\n' "$*" >&2; exit 1; }

# Questions are answered at the terminal, also when this script arrives through a pipe.
# (MIMIR_ANSWERS_FROM_STDIN=1 reads them from standard input instead; the tests use it.)
if [ -z "${MIMIR_ANSWERS_FROM_STDIN:-}" ] && (exec 3</dev/tty) 2>/dev/null; then exec 3</dev/tty; else exec 3<&0; fi
ask() { printf '%s' "$1"; IFS= read -r REPLY <&3 || REPLY=''; }

say ''
say 'Wi24rd Mimir installer'
say ''

command -v git >/dev/null 2>&1 || stop 'git was not found. Install it from https://git-scm.com'
command -v gh >/dev/null 2>&1 || stop 'the GitHub CLI (gh) was not found. Install it from https://cli.github.com'
command -v node >/dev/null 2>&1 || stop 'Node.js was not found. Install version 20 or later from https://nodejs.org'
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || stop "Node.js $(node -v) is too old. Mimir needs version 20 or later."
gh auth status >/dev/null 2>&1 || stop 'you are not signed in to GitHub. Run "gh auth login" and start again.'

# Run inside an existing copy, it only starts the setup.
if [ -f src/setup.mjs ] && grep -q '"wi24rd-mimir"' package.json 2>/dev/null; then
  say 'This folder is already a copy of Mimir. Starting its setup.'
  exec node src/setup.mjs <&3
fi

account="$(gh api user --jq .login)" || stop 'could not read your account name from GitHub.'

ask 'Name of your Mimir repository [mimir]: '
name="${REPLY:-mimir}"
case "$name" in
  ''|.*|-*|*[!A-Za-z0-9._-]*) stop "\"$name\" cannot be used as a repository name. Use letters, digits, dots, hyphens and underscores." ;;
esac
[ -e "$name" ] && stop "there is already a file or folder named \"$name\" here."
gh repo view "$account/$name" >/dev/null 2>&1 && stop "$account/$name already exists on GitHub. Choose another name, or clone it and run: node src/setup.mjs"

say ''
say '  public   The dashboard gets an address on GitHub Pages, and badges are possible.'
say '           Your figures can still be encrypted; the setup asks about that.'
say '  private  Nobody else sees the repository. The dashboard runs on this computer only.'
ask 'Public or private [public]: '
case "${REPLY:-public}" in
  public|Public|PUBLIC) visibility=public ;;
  private|Private|PRIVATE) visibility=private ;;
  *) stop "\"$REPLY\" is neither public nor private." ;;
esac

say ''
say "This creates the $visibility repository $account/$name from $TEMPLATE"
say "and clones it into $(pwd)/$name"
ask 'Go ahead? [Y/n] '
case "${REPLY:-y}" in y|Y|yes|Yes|YES) ;; *) stop 'nothing was created.' ;; esac

gh repo create "$name" --template "$TEMPLATE" "--$visibility" --clone || stop 'the repository could not be created.'
cd "$name"

# GitHub fills a new copy in the background. Wait until the files are there.
tries=0
while [ ! -f src/setup.mjs ]; do
  tries=$((tries + 1))
  [ "$tries" -gt 20 ] && stop "the files have not arrived in $account/$name. Wait a minute, then run in the folder \"$name\": git pull origin main && node src/setup.mjs"
  sleep 3
  git pull --quiet origin main >/dev/null 2>&1 || true
done

say ''
say "Your copy is in the folder \"$name\". Starting its setup."
exec node src/setup.mjs <&3
