#!/usr/bin/env bash

set -euo pipefail

base_ref="${1:-origin/main}"
head_ref="${2:-}"

if ! git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1; then
  echo "repository-hygiene: base ref is not a commit: ${base_ref}" >&2
  exit 2
fi

diff_args=(--name-only --diff-filter=ACMR -z "${base_ref}")
if [[ -n "${head_ref}" ]]; then
  if ! git rev-parse --verify "${head_ref}^{commit}" >/dev/null 2>&1; then
    echo "repository-hygiene: head ref is not a commit: ${head_ref}" >&2
    exit 2
  fi
  diff_args+=("${head_ref}")
fi

blocked=()
while IFS= read -r -d '' path; do
  case "/${path}" in
    */.DS_Store|*/node_modules/*|*/target/*|*/dist/*|*/build/*|*.dmg|*.msi|*.AppImage|*.p12|*.mobileprovision)
      blocked+=("${path}")
      ;;
    */.env.example)
      ;;
    */.env|*/.env.*)
      blocked+=("${path}")
      ;;
    */app/control-desktop/src-tauri/binaries/*)
      if [[ "${path}" != "app/control-desktop/src-tauri/binaries/.gitkeep" ]]; then
        blocked+=("${path}")
      fi
      ;;
  esac
done < <(git diff "${diff_args[@]}")

if ((${#blocked[@]} > 0)); then
  echo "repository-hygiene: newly added generated or local-only files:" >&2
  printf '  - %s\n' "${blocked[@]}" >&2
  exit 1
fi

if [[ -n "${head_ref}" ]]; then
  git diff --check "${base_ref}" "${head_ref}"
else
  git diff --check "${base_ref}"
fi

for required in \
  app/control-desktop/package-lock.json \
  app/control-desktop/src-tauri/Cargo.lock; do
  if [[ ! -f "${required}" ]]; then
    echo "repository-hygiene: required lockfile is missing: ${required}" >&2
    exit 1
  fi
done

echo "repository-hygiene: no new generated or local-only files detected"
