#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-}"
IDENTITY="${MAC_CODESIGN_IDENTITY:--}"
KEYCHAIN="${MAC_CODESIGN_KEYCHAIN:-}"
ENTITLEMENTS="${MAC_CODESIGN_ENTITLEMENTS:-build/entitlements.mac.plist}"
TIMESTAMP_ARG=("--timestamp=none")

if [[ -z "${APP_PATH}" ]]; then
  APP_PATH="$(find release -maxdepth 3 -type d -name 'Minimax 纪.app' | head -n 1 || true)"
fi

if [[ -z "${APP_PATH}" || ! -d "${APP_PATH}" ]]; then
  echo "未找到 Minimax 纪.app，请先运行 mac 构建。"
  exit 1
fi

if [[ ! -f "${ENTITLEMENTS}" ]]; then
  echo "未找到 entitlements 文件：${ENTITLEMENTS}"
  exit 1
fi

if [[ "${IDENTITY}" != "-" ]]; then
  TIMESTAMP_ARG=("--timestamp")
fi

KEYCHAIN_ARGS=()
if [[ -n "${KEYCHAIN}" ]]; then
  KEYCHAIN="${KEYCHAIN/#\~/${HOME}}"
  if [[ ! -f "${KEYCHAIN}" ]]; then
    echo "指定的 keychain 不存在：${KEYCHAIN}"
    exit 1
  fi
  KEYCHAIN_ARGS=("--keychain" "${KEYCHAIN}")
fi

sign_item() {
  local item="$1"
  local codesign_args=(
    --force
    --options runtime
    "${TIMESTAMP_ARG[@]}"
    --entitlements "${ENTITLEMENTS}"
  )

  if [[ ${#KEYCHAIN_ARGS[@]} -gt 0 ]]; then
    codesign_args+=("${KEYCHAIN_ARGS[@]}")
  fi

  codesign_args+=(--sign "${IDENTITY}" "${item}")

  echo "签名：${item}"
  codesign "${codesign_args[@]}"
}

is_macho() {
  local item="$1"
  file -b "${item}" | grep -q 'Mach-O'
}

echo "使用签名身份：${IDENTITY}"

while IFS= read -r item; do
  if is_macho "${item}"; then
    sign_item "${item}"
  fi
done < <(
  find "${APP_PATH}" -type f \
    ! -path '*/_CodeSignature/*' \
    ! -path '*/Contents/Resources/app.asar*' \
    -print | sort -r
)

while IFS= read -r item; do
  sign_item "${item}"
done < <(
  find "${APP_PATH}" -type d \( \
    -name '*.framework' -o \
    -name '*.app' \
  \) ! -path "${APP_PATH}" -print | sort -r
)

sign_item "${APP_PATH}"
codesign --verify --deep --strict --verbose=2 "${APP_PATH}"
echo "已签名并验证：${APP_PATH}"
