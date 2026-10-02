// Builds the Linux packages (AppImage and .deb) from Windows, in WSL: electron-builder only makes
// them on Linux. It copies the working tree into the WSL home (keeping the Linux node_modules of
// earlier builds), installs the dependencies there, runs `pnpm dist:linux` and copies the packages
// back to release/.
//
// Needs WSL 2 with a Linux distribution (PLANNER_WSL_DISTRO, Ubuntu by default) and Node 22 or
// newer in it, on the PATH or in ~/.local/share/planner-node.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DISTRO = process.env.PLANNER_WSL_DISTRO ?? 'Ubuntu'
// The same pnpm as the lockfile (and as on Windows).
const PNPM = 'pnpm@11.5.1'

const SCRIPT = `
set -euo pipefail
SRC="$(wslpath -a "$1")"
WORK="$HOME/planner-build"
if [ -d "$HOME/.local/share/planner-node/bin" ]; then export PATH="$HOME/.local/share/planner-node/bin:$PATH"; fi
MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$MAJOR" -lt 22 ]; then
  echo "Node 22 or newer is needed in WSL (found: $(node -v 2>/dev/null || echo none))." >&2
  echo "Install it on the PATH of the distribution, or unpack it in ~/.local/share/planner-node." >&2
  exit 2
fi
echo "Node $(node -v) in $WORK"
mkdir -p "$WORK"
find "$WORK" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
tar -C "$SRC" \\
  --exclude=./node_modules --exclude=./out --exclude=./release --exclude=./.git --exclude=./test-results \\
  --exclude=./playwright-report --exclude=./coverage --exclude=./.planner-data \\
  -cf - . | tar -C "$WORK" -xf -
cd "$WORK"
npx --yes ${PNPM} install --frozen-lockfile
npx --yes ${PNPM} dist:linux
mkdir -p "$SRC/release"
cp release/*.AppImage release/*.deb "$SRC/release/"
ls -la "$SRC/release/" | grep -E 'AppImage|\\.deb'
`

// The script goes through stdin, with Unix line endings whatever the checkout of this file. '-e' runs
// bash without a shell in between, and the path uses '/', so no backslash is lost on the way.
const result = spawnSync('wsl.exe', ['-d', DISTRO, '-e', 'bash', '-s', '--', ROOT.replaceAll('\\', '/')], {
  input: SCRIPT.replace(/\r\n/g, '\n'),
  stdio: ['pipe', 'inherit', 'inherit']
})
if (result.error) {
  console.error(`Could not run WSL (${result.error.message}). Is WSL 2 installed, with the "${DISTRO}" distribution?`)
  process.exit(1)
}
process.exit(result.status ?? 1)
