#!/usr/bin/env bash
# 临时方案：把 Cocos 构建产物 build/ios/data 同步进 Xcode 生成的 .app，
# 修复「cc.config 有条目但 import json 未打进包」导致的 readFile failed。
#
# 用法（Xcode Run 之后执行）:
#   ./scripts/sync-ios-app-assets.sh
#   ./scripts/sync-ios-app-assets.sh --target iphoneos
#   ./scripts/sync-ios-app-assets.sh --app /path/to/dramai-mobile.app
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_ASSETS="${ROOT}/build/ios/data/assets"
PROJ_DIR="${ROOT}/build/ios/proj"

TARGET="all"
APP_PATH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-all}"
      shift 2
      ;;
    --app)
      APP_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -d "$DATA_ASSETS" ]]; then
  echo "[sync-ios] 缺少构建目录: $DATA_ASSETS" >&2
  echo "请先在 Cocos Creator 中构建 iOS。" >&2
  exit 1
fi

sync_one_app() {
  local app="$1"
  if [[ ! -d "$app" ]]; then
    echo "[sync-ios] 跳过（不存在）: $app"
    return 0
  fi
  local dest="${app}/assets"
  mkdir -p "$dest"
  echo "[sync-ios] 同步 -> $dest"
  rsync -a --delete "${DATA_ASSETS}/" "${dest}/"
  # 校验 basicSeeds1（农场配置常见问题文件）
  local seed_json="${dest}/resources/import/21/21b5af4e-cee3-40f3-9978-04f0376ebfb5.json"
  if [[ -f "$seed_json" ]]; then
    echo "[sync-ios]   OK basicSeeds1: $seed_json"
  else
    echo "[sync-ios]   WARN 未找到 basicSeeds1 import（请确认 Cocos 已构建 resources）" >&2
  fi
}

if [[ -n "$APP_PATH" ]]; then
  sync_one_app "$APP_PATH"
  echo "[sync-ios] 完成。请重启 App（勿在未同步时再次 Run 覆盖）。"
  exit 0
fi

case "$TARGET" in
  all)
    sync_one_app "${PROJ_DIR}/Debug-iphoneos/dramai-mobile.app"
    sync_one_app "${PROJ_DIR}/Debug-iphonesimulator/dramai-mobile.app"
    ;;
  iphoneos)
    sync_one_app "${PROJ_DIR}/Debug-iphoneos/dramai-mobile.app"
    ;;
  iphonesimulator|simulator)
    sync_one_app "${PROJ_DIR}/Debug-iphonesimulator/dramai-mobile.app"
    ;;
  *)
    echo "[sync-ios] 未知 --target: $TARGET（all | iphoneos | iphonesimulator）" >&2
    exit 1
    ;;
esac

echo "[sync-ios] 完成。真机/模拟器请先杀掉 App 再启动；Xcode 再次 Run 会覆盖 .app，需重新执行本脚本。"
