#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Minimax 纪"
APP_BUNDLE="release/mac-arm64/${APP_NAME}.app"
INSTALL_PATH="/Applications/${APP_NAME}.app"
APPLE_KEYS_DIR="/Users/hunter/Workspace/apple_keys"
APPLE_METADATA_ENV="${APPLE_KEYS_DIR}/apple_key_metadata.env"
DEFAULT_KEYCHAIN="${HOME}/Library/Keychains/apple-build-signing.keychain-db"
DO_NOTARIZE=0
ELECTRON_CACHE_DIR="${HOME}/Library/Caches/electron"

usage() {
  cat <<EOF
用法：$0 [--sign]

默认：重新构建、普通 ad-hoc app 签名、安装到 /Applications 并启动。
--sign：使用 Developer ID 签名、notarytool 公证、staple、spctl 校验。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sign)
      DO_NOTARIZE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1"
      usage
      exit 1
      ;;
  esac
done

load_signing_env() {
  if [[ ! -f "${APPLE_METADATA_ENV}" ]]; then
    echo "未找到 Apple 签名配置：${APPLE_METADATA_ENV}"
    exit 1
  fi

  set -a
  # shellcheck source=/Users/hunter/Workspace/apple_keys/apple_key_metadata.env
  source "${APPLE_METADATA_ENV}"
  set +a

  export MAC_CODESIGN_IDENTITY="${MAC_CODESIGN_IDENTITY:-${APPLE_CERTIFICATE_ID:-}}"
  export MAC_CODESIGN_KEYCHAIN="${MAC_CODESIGN_KEYCHAIN:-${DEFAULT_KEYCHAIN}}"

  if [[ -z "${MAC_CODESIGN_IDENTITY}" ]]; then
    echo "apple_key_metadata.env 中缺少 APPLE_CERTIFICATE_ID 或 MAC_CODESIGN_IDENTITY"
    exit 1
  fi

  for required_var in APPLE_API_KEY APPLE_API_ISSUER APPLE_API_KEY_PATH; do
    if [[ -z "${!required_var:-}" ]]; then
      echo "apple_key_metadata.env 中缺少 ${required_var}"
      exit 1
    fi
  done

  if [[ ! -f "${APPLE_API_KEY_PATH}" ]]; then
    echo "Apple notary API key 不存在：${APPLE_API_KEY_PATH}"
    exit 1
  fi
}

find_app_bundle() {
  if [[ ! -d "${APP_BUNDLE}" ]]; then
    APP_BUNDLE="$(find release -maxdepth 3 -type d -name "${APP_NAME}.app" | head -n 1 || true)"
  fi

  if [[ -z "${APP_BUNDLE}" || ! -d "${APP_BUNDLE}" ]]; then
    echo "未找到构建产物：${APP_NAME}.app"
    exit 1
  fi
}

notarize_app() {
  local app_path="$1"
  local tmp_dir zip_path result_json status submission_id submit_status

  tmp_dir="$(mktemp -d)"
  zip_path="${tmp_dir}/${APP_NAME}.zip"
  result_json="${tmp_dir}/notary-result.json"

  echo "打包 app 用于公证：${zip_path}"
  ditto -c -k --keepParent "${app_path}" "${zip_path}"

  echo "提交 Apple notary service 并等待结果..."
  set +e
  xcrun notarytool submit "${zip_path}" \
    --key "${APPLE_API_KEY_PATH}" \
    --key-id "${APPLE_API_KEY}" \
    --issuer "${APPLE_API_ISSUER}" \
    --wait \
    --output-format json | tee "${result_json}"
  submit_status=${PIPESTATUS[0]}
  set -e

  status="$(plutil -extract status raw -o - "${result_json}" 2>/dev/null || true)"
  submission_id="$(plutil -extract id raw -o - "${result_json}" 2>/dev/null || true)"

  if [[ "${submit_status}" -ne 0 || "${status}" != "Accepted" ]]; then
    echo "公证失败，状态：${status:-unknown}，notarytool exit=${submit_status}"
    if [[ -n "${submission_id}" ]]; then
      xcrun notarytool log "${submission_id}" \
        --key "${APPLE_API_KEY_PATH}" \
        --key-id "${APPLE_API_KEY}" \
        --issuer "${APPLE_API_ISSUER}" || true
    fi
    rm -rf "${tmp_dir}"
    exit 1
  fi

  echo "公证通过：${submission_id}"
  xcrun stapler staple "${app_path}"
  xcrun stapler validate "${app_path}"
  spctl --assess --type execute --verbose=4 "${app_path}"
  rm -rf "${tmp_dir}"
}

stop_existing_processes() {
  echo "结束已运行的 ${APP_NAME}/espanso 进程..."
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true

  for process_name in "${APP_NAME}" "espanso"; do
    pkill -x "${process_name}" >/dev/null 2>&1 || true
  done

  sleep 1

  for process_name in "${APP_NAME}" "espanso"; do
    pkill -9 -x "${process_name}" >/dev/null 2>&1 || true
  done
}

cached_zip_is_valid() {
  local zip_path="$1"
  [[ -f "${zip_path}" ]] && unzip -tq "${zip_path}" >/dev/null 2>&1
}

download_with_retry() {
  local url="$1"
  local output="$2"
  local tmp_output="${output}.download"

  rm -f "${tmp_output}"
  curl \
    --fail \
    --location \
    --retry 8 \
    --retry-delay 2 \
    --retry-max-time 300 \
    --connect-timeout 20 \
    --output "${tmp_output}" \
    "${url}"

  unzip -tq "${tmp_output}" >/dev/null
  mv "${tmp_output}" "${output}"
}

prefetch_electron_runtime() {
  local electron_version arch zip_name cache_zip url

  electron_version="$(node -p "require('electron/package.json').version")"
  arch="$(uname -m)"
  if [[ "${arch}" == "arm64" ]]; then
    arch="arm64"
  else
    arch="x64"
  fi

  mkdir -p "${ELECTRON_CACHE_DIR}"
  zip_name="electron-v${electron_version}-darwin-${arch}.zip"
  cache_zip="${ELECTRON_CACHE_DIR}/${zip_name}"
  url="https://github.com/electron/electron/releases/download/v${electron_version}/${zip_name}"

  if cached_zip_is_valid "${cache_zip}"; then
    echo "Electron runtime 已在缓存中：${cache_zip}"
    return
  fi

  echo "预下载 Electron runtime：${url}"
  echo "缓存位置：${cache_zip}"
  rm -f "${cache_zip}" "${cache_zip}.download"
  download_with_retry "${url}" "${cache_zip}"
}

install_and_launch() {
  stop_existing_processes

  echo "安装到 ${INSTALL_PATH}"
  rm -rf "${INSTALL_PATH}"
  cp -R "${APP_BUNDLE}" /Applications/

  if [[ "${DO_NOTARIZE}" -eq 1 ]]; then
    xcrun stapler validate "${INSTALL_PATH}"
    spctl --assess --type execute --verbose=4 "${INSTALL_PATH}"
  fi

  echo "从 /Applications 启动..."
  open "${INSTALL_PATH}"
}

if [[ "${DO_NOTARIZE}" -eq 1 ]]; then
  load_signing_env
else
  export MAC_CODESIGN_IDENTITY="${MAC_CODESIGN_IDENTITY:--}"
fi

echo "重新编译 macOS app..."
rm -rf release/mac release/mac-arm64
pnpm icons
pnpm build
prefetch_electron_runtime
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac dir

find_app_bundle

echo "重新签名：${APP_BUNDLE}"
./scripts/sign-mac-app.sh "${APP_BUNDLE}"

if [[ "${DO_NOTARIZE}" -eq 1 ]]; then
  notarize_app "${APP_BUNDLE}"
fi

install_and_launch
