# Эмулятор Android (заход 7.234)

Эмулятор, на котором агент сам запускает и проверяет оболочку RusoFácil,
вместо видео с телефона владельца. Поднят на Mac Studio (M4 Max, 36 ГБ);
на ноутбуке с 8 ГБ он не помещается (7.230) — там не запускать.

## Одной командой

```sh
bash scripts/emulator/rf-emulator.sh all
```

Поднимает AVD, собирает отладочный APK из текущего дерева, ставит его,
делает холодный старт, снимает экран в
`~/Desktop/rusofacil-emulator-<дата>/` и гасит эмулятор. ≈40 с, если
сборка Gradle уже тёплая.

Первый раз на новой машине — сначала `setup` (пакеты SDK и AVD,
≈5 ГБ на диске, без sudo и без Android Studio).

## По шагам

| команда | что делает |
|---|---|
| `setup` | `sdkmanager`: `emulator`, `platform-tools`, образ `system-images;android-36;google_apis_playstore;arm64-v8a`; `avdmanager`: AVD `rusofacil-api36` (профиль `pixel_7_pro`, экран переопределён на 1220×2712 / 440 dpi как у POCO X6 Pro, RAM 4 ГБ) |
| `up` | запуск с `-no-snapshot`, ждёт `sys.boot_completed` |
| `build` | `npx cap sync android` + `./gradlew assembleDebug` **через ссылку `~/.rusofacil-ascii`** — Kotlin-компилятор не собирает проект по пути с кириллицей |
| `install` | `adb install -r` + холодный старт |
| `cold` | `am force-stop` + холодный старт (logcat очищается) |
| `shot <имя>` | `adb exec-out screencap -p` → `<имя>.png` |
| `logcat <имя>` | logcat процесса приложения → `<имя>.log` |
| `net off` / `net on` | `svc wifi` + `svc data` |
| `down` | `adb emu kill`, при зависании `pkill` |

Каталог снимков меняется переменной `RF_EMU_OUT`.

## Нажатия — по координатам из дерева экрана, не вслепую

```sh
node scripts/emulator/ui.mjs list [регулярка]   # узлы с текстом и центры
node scripts/emulator/ui.mjs tap "^Descargar"   # найти и нажать
```

Содержимое WebView видно в `uiautomator dump` через дерево доступности.
Сразу после холодного старта оно бывает пустым — `ui.mjs` повторяет
дамп до четырёх раз. Поверх страницы может висеть системный вопрос про
уведомления («Allow / Don’t allow») — тогда страницы в дампе нет.

## Заглянуть внутрь страницы

Отладочный APK разрешает отладку WebView:

```sh
adb forward tcp:9222 localabstract:$(adb shell cat /proc/net/unix | grep -o 'webview_devtools_remote_[0-9]*' | head -1)
curl -s localhost:9222/json
```

Дальше — протокол Chrome DevTools (`Runtime.evaluate`,
`Runtime.exceptionThrown`) по websocket.

## Чего эмулятор не умеет

* **Покупки Google.** В Google-аккаунт на эмуляторе не входим, поэтому
  RevenueCat пишет `Billing is not available in this device` — это
  ожидаемо, а не дефект. Покупки проверяются только на телефоне.
* **Это не POCO.** Другой WebView (на образе r07 — 133.0.6943.137,
  на телефоне обновляется из Play), нет HyperOS, её энергосбережения и
  убийства фоновых процессов. Системный язык — английский.
* Сайт внутри — **боевой** `https://rusofacilapp.com`: APK из `main`
  показывает то, что сейчас на проде, а не незамерженную ветку. Для
  проверки ветки — рецепт `adb reverse` + `CAPACITOR_LIVE_RELOAD=1` в
  PROGRESS.md (7.230, часть 2).
