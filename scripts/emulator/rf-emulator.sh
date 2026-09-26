#!/usr/bin/env bash
# Эмулятор Android для проверки оболочки RusoFácil без телефона владельца.
# Заход 7.234 (26.09.2026). Инструкция — scripts/emulator/README.md.
#
#   bash scripts/emulator/rf-emulator.sh all          # поднять, собрать, поставить, снимок, погасить
#   bash scripts/emulator/rf-emulator.sh setup        # один раз: пакеты SDK + AVD
#   bash scripts/emulator/rf-emulator.sh up           # поднять и дождаться загрузки
#   bash scripts/emulator/rf-emulator.sh build        # cap sync + assembleDebug
#   bash scripts/emulator/rf-emulator.sh install      # adb install -r + холодный старт
#   bash scripts/emulator/rf-emulator.sh shot <имя>   # снимок экрана в $RF_EMU_OUT/<имя>.png
#   bash scripts/emulator/rf-emulator.sh net on|off   # сеть эмулятора
#   bash scripts/emulator/rf-emulator.sh cold         # force-stop + холодный старт
#   bash scripts/emulator/rf-emulator.sh logcat <имя> # logcat процесса приложения в файл
#   bash scripts/emulator/rf-emulator.sh down         # погасить
#
# Нажатия по тексту на экране — scripts/emulator/ui.mjs (через uiautomator dump).
# Секретов скрипт не читает и не пишет; в Google-аккаунт эмулятор не входит.
set -euo pipefail

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_HOME
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
AVDMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/avdmanager"
EMULATOR="$ANDROID_HOME/emulator/emulator"
ADB="$ANDROID_HOME/platform-tools/adb"

AVD="${RF_AVD:-rusofacil-api36}"
IMAGE="system-images;android-36;google_apis_playstore;arm64-v8a"
PKG="com.rusofacilapp.app"
OUT="${RF_EMU_OUT:-$HOME/Desktop/rusofacil-emulator-$(date +%F)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Kotlin-компилятор Gradle не собирает проект, в пути к которому есть
# кириллица (ловушка 7.230), — поэтому сборка идёт через ссылку без неё.
ASCII_LINK="${RF_ASCII_LINK:-$HOME/.rusofacil-ascii}"
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"

say() { printf '[rf-emulator] %s\n' "$*"; }

cmd_setup() {
  yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --install "platform-tools" "emulator" "$IMAGE"
  if "$EMULATOR" -list-avds | grep -qx "$AVD"; then
    say "AVD $AVD уже есть"
  else
    echo no | "$AVDMANAGER" create avd -n "$AVD" -k "$IMAGE" -d pixel_7_pro
  fi
  # Экран как у POCO X6 Pro (6,67″, 1220×2712), 4 ГБ памяти, клавиатура хоста.
  local cfg="$HOME/.android/avd/$AVD.avd/config.ini"
  local kv
  for kv in hw.lcd.width=1220 hw.lcd.height=2712 hw.lcd.density=440 \
            hw.ramSize=4096 hw.keyboard=yes hw.gpu.enabled=yes hw.gpu.mode=auto \
            disk.dataPartition.size=6G; do
    local k="${kv%%=*}"
    grep -v "^$k *=" "$cfg" > "$cfg.tmp" || true
    echo "$kv" >> "$cfg.tmp"
    mv "$cfg.tmp" "$cfg"
  done
  say "AVD $AVD готов: $cfg"
}

cmd_up() {
  if "$ADB" devices | grep -q '^emulator-'; then
    say "эмулятор уже запущен"
  else
    # -no-snapshot: каждый запуск — холодная загрузка системы, без
    # состояния прошлого прогона в оперативной памяти (данные приложения
    # на диске AVD при этом сохраняются; стереть их — `adb uninstall`).
    nohup "$EMULATOR" -avd "$AVD" -no-snapshot -no-boot-anim -netdelay none -netspeed full \
      > "${TMPDIR:-/tmp}/rf-emulator.log" 2>&1 &
    say "запущен, журнал ${TMPDIR:-/tmp}/rf-emulator.log"
  fi
  "$ADB" wait-for-device
  local i
  for i in $(seq 1 180); do
    [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && break
    sleep 1
  done
  "$ADB" shell input keyevent 82 >/dev/null 2>&1 || true  # снять экран блокировки
  say "система загружена ($("$ADB" shell getprop ro.build.version.release | tr -d '\r'), API $("$ADB" shell getprop ro.build.version.sdk | tr -d '\r'))"
}

cmd_build() {
  ln -sfn "$ROOT" "$ASCII_LINK"
  (cd "$ASCII_LINK" && npx cap sync android)
  (cd "$ASCII_LINK/android" && ./gradlew assembleDebug --no-daemon -q)
  ls -l "$APK"
}

cmd_install() {
  "$ADB" install -r "$APK"
  cmd_cold
}

cmd_cold() {
  "$ADB" shell am force-stop "$PKG"
  "$ADB" logcat -c || true
  "$ADB" shell am start -W -n "$PKG/.MainActivity" | grep -E 'Status|TotalTime|WaitTime' || true
}

cmd_shot() {
  local name="${1:?имя снимка}"
  mkdir -p "$OUT"
  "$ADB" exec-out screencap -p > "$OUT/$name.png"
  say "снимок $OUT/$name.png"
}

cmd_logcat() {
  local name="${1:?имя файла}"
  mkdir -p "$OUT"
  local pid
  pid="$("$ADB" shell pidof "$PKG" | tr -d '\r' || true)"
  if [ -n "$pid" ]; then
    "$ADB" logcat -d --pid="$pid" > "$OUT/$name.log"
  else
    "$ADB" logcat -d > "$OUT/$name.log"
  fi
  say "logcat $OUT/$name.log ($(wc -l < "$OUT/$name.log") строк)"
}

cmd_net() {
  case "${1:?on|off}" in
    off) "$ADB" shell svc wifi disable; "$ADB" shell svc data disable ;;
    on)  "$ADB" shell svc wifi enable;  "$ADB" shell svc data enable ;;
    *) echo "net on|off" >&2; exit 2 ;;
  esac
  sleep 3
  "$ADB" shell dumpsys connectivity | grep -m1 -E 'Active default network' || true
}

cmd_down() {
  "$ADB" emu kill >/dev/null 2>&1 || true
  local i
  for i in $(seq 1 20); do
    pgrep -f "qemu-system.*$AVD" >/dev/null || { say "погашен"; return 0; }
    sleep 1
  done
  pkill -f qemu-system || true
  pkill -f "$EMULATOR" || true
  say "погашен принудительно"
}

cmd_all() {
  cmd_up
  cmd_build
  cmd_install
  sleep 15
  cmd_shot "start-$(date +%H%M%S)"
  cmd_down
}

sub="${1:-all}"
shift || true
case "$sub" in
  setup|up|build|install|cold|shot|logcat|net|down|all) "cmd_$sub" "$@" ;;
  *) sed -n '2,16p' "$0"; exit 2 ;;
esac
