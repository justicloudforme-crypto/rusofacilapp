# RusoFácilapp — сборка мобильного приложения (Capacitor)

Этот проект обёрнут в [Capacitor](https://capacitorjs.com/) (бесплатный,
open-source, Ionic) — нативная WebView-обёртка, которая грузит реальный
задеплоенный/локальный сайт RusoFácilapp.com (не статический экспорт: сайт
использует серверные компоненты, БД, аутентификацию и Stripe, так что
статический билд ему не подходит).

## Что нужно установить (на своей машине, не здесь)

- **iOS**: полноценный **Xcode** (не только Command Line Tools) из Mac App
  Store, бесплатно. CocoaPods не нужен — используется Swift Package Manager.
- **Android**: **Android Studio** ([developer.android.com](https://developer.android.com/studio)), бесплатно. При первом запуске он сам предложит поставить Android SDK.

## Быстрый старт (разработка, локальный сервер)

1. Узнайте IP-адрес своей машины в локальной сети (например, `ipconfig getifaddr en0` на Mac) и обновите `devServerUrl` в `capacitor.config.ts`, если он изменился (сейчас там `http://192.168.1.69:3000`).
2. Запустите dev-сервер: `npm run dev`.
3. Откройте нативный проект:
   - iOS: `npm run cap:ios` (откроет Xcode) → выберите симулятор или подключённый iPhone → ▶️ Run.
   - Android: `npm run cap:android` (откроет Android Studio) → выберите эмулятор/устройство → ▶️ Run.
4. Приложение в симуляторе/на устройстве загрузит ваш локальный сайт напрямую — как live reload.

Телефон/симулятор должен быть в той же Wi-Fi сети, что и компьютер (для реального устройства; симулятор iOS обычно достаёт до `localhost` хоста, но лучше везде использовать IP для единообразия).

**Реальный баг, найденный и исправленный (2026-08-23)**: даже с правильным
IP в `capacitor.config.ts`, WebView не мог открыть `server.url` — падал на
`server.errorPath` ("Sin conexión"). Причина не в адресе, а в том, что
**обе платформы по умолчанию блокируют cleartext (`http://`) вообще**,
а не только `localhost` — `server.cleartext` в `capacitor.config.ts` сам
по себе это не отключает, нужны отдельные нативные флаги:
- iOS: `NSAppTransportSecurity` / `NSAllowsArbitraryLoads` в
  `ios/App/App/Info.plist` — отсутствовал целиком, теперь добавлен.
- Android: `android:usesCleartextTraffic="true"` в `AndroidManifest.xml`
  — тоже отсутствовал, теперь добавлен.

Оба помечены в файлах как dev-only и **обязательны к удалению** (или
переходу на HTTPS-продакшен origin) перед публикацией в сторы — Apple
review и Play Console pre-launch report оба это проверяют.

## Тестирование на реальном телефоне (не симулятор, без TestFlight/APK)

Важный факт: **TestFlight (iOS) и внутренний тест-трек (Android) не
нужны для того, чтобы просто запустить приложение на своём собственном
телефоне.** Это отдельные механизмы для раздачи сборки ДРУГИМ людям —
для собственного устройства достаточно обычного запуска из Xcode/Android
Studio, того же самого, что уже использовалось для симулятора, только с
выбором реального устройства вместо симулятора в выпадающем списке.
Ни TestFlight, ни APK-файл, ни ссылка, ни QR-код тут не нужны — Xcode/
Android Studio ставят приложение на телефон напрямую по кабелю или по Wi-Fi.

**iOS (нужен провод/USB-C или Lightning кабель хотя бы один раз):**
1. Подключите iPhone к Mac кабелем.
2. `npm run cap:ios` → откроется Xcode.
3. В самом верху окна Xcode, где раньше был выбран симулятор — откройте
   список устройств и выберите свой iPhone (появится в списке после
   подключения кабелем; один раз Xcode попросит "Trust This Computer" —
   подтвердите на самом телефоне).
4. **Signing & Capabilities** (вкладка проекта App → Signing & Capabilities):
   выберите свой обычный Apple ID в поле "Team" — бесплатный, без
   платной подписки Apple Developer Program ($99/год не нужны для этого
   шага, она нужна только для публикации в сторе). Если Apple ID ещё не
   добавлен в Xcode — Xcode → Settings → Accounts → "+" → войти обычным
   Apple ID.
5. ▶️ Run. При первом запуске телефон покажет "Untrusted Developer" —
   на телефоне: **Настройки → Основные → VPN и управление устройством →
   выбрать свой Apple ID/сертификат → Trust**. Затем запустите ещё раз.
6. Телефон должен быть в той же Wi-Fi сети, что и компьютер (сайт
   грузится с LAN IP компьютера, см. выше) — кабель нужен только для
   установки приложения, не для его работы.

**Android (кабель USB нужен один раз, дальше можно по Wi-Fi):**
1. На телефоне: **Настройки → О телефоне → 7 раз нажать "Номер сборки"**
   (включит режим разработчика) → **Настройки → Система → Для
   разработчиков → включить "Отладка по USB"**.
2. Подключите телефон к компьютеру кабелем, на телефоне подтвердите
   "Разрешить отладку по USB".
3. `npm run cap:android` → откроется Android Studio.
4. В выпадающем списке устройств (там же, где был эмулятор) появится ваш
   телефон — выберите его.
5. ▶️ Run — Android Studio сам поставит приложение на телефон. Никакой
   подписи/аккаунта Google Play для этого не требуется вообще.
6. Телефон тоже должен быть в той же Wi-Fi сети, что и компьютер.

**Ограничение, о котором стоит знать заранее**: проверка покупок
(RevenueCat) через локальный `.storekit`-файл официально гарантирована
Apple только в **Simulator** — на реальном устройстве это тоже часто
работает, но не железно, попробуйте, если что-то пойдёт не так — это
не баг в коде, а ограничение тестовой среды, не требующее починки.
Для Android локального аналога StoreKit нет вообще — тест покупок на
Android остаётся заблокирован до верификации Google Play Console
(нужны License Testers, которые настраиваются только там). Для этой
задачи (UI/анимации/кнопки/вёрстка) это не помеха — тестируйте всё,
кроме собственно нажатия "Купить", на реальном устройстве уже сейчас.

## Переключение на продакшен (перед публикацией)

Как только сайт задеплоен на реальный домен (после Фазы 2 — миграции на Turso и хостинга):

```bash
CAPACITOR_SERVER_URL=https://ваш-домен.com npx cap sync
```

Или просто зашейте прод-URL напрямую в `capacitor.config.ts` перед финальной сборкой для стора — тогда переменная окружения не нужна.

После любого изменения `capacitor.config.ts` — обязательно `npm run cap:sync` (или заново открыть `cap:ios`/`cap:android`), чтобы нативные проекты подхватили новый конфиг.

## Иконки и splash screen

Исходники — `resources/icon.png` (1024×1024) и `resources/splash.png`
(2732×2732), сгенерированы из фирменного sparkle-глифа скриптом
`scripts/generate-pwa-icons.ts` (`npx tsx scripts/generate-pwa-icons.ts`).
Чтобы перегенерировать нативные размеры под iOS/Android после правки
исходников:

```bash
npm install -D @capacitor/assets   # одноразово, у него есть уязвимости в
                                    # dev-зависимостях — не оставляйте в
                                    # package.json надолго
npx capacitor-assets generate
npm uninstall @capacitor/assets
```

## `appId`

Установлен как `com.rusofacilapp.app` — reverse-domain реально купленного
домена `rusofacilapp.com` (2026-08-16), больше не плейсхолдер. Это часть
идентификации приложения в сторах и не может быть изменено после первой
публикации без создания нового листинга — если домен/бренд когда-нибудь
снова поменяется, `appId` из уже опубликованного приложения трогать нельзя.

## Публикация в сторы (не бесплатно — ограничение платформ, не инструментов)

- **Apple App Store**: аккаунт Apple Developer Program — $99/год.
- **Google Play**: аккаунт Google Play Console — $25 разово.

Сами инструменты (Capacitor, Xcode, Android Studio) — бесплатны; эти
взносы берут сами платформы за право публикации, обойти нельзя.

## Что уже настроено

- `capacitor.config.ts` — конфиг, remote-URL режим, сплэш/статус-бар плагины.
- `ios/`, `android/` — сгенерированные нативные проекты (закоммичены в git — это нормально для Capacitor, там живут нативные конфиги).
- `resources/icon.png`, `resources/splash.png` — исходники брендинга.

## Подписки (RevenueCat)

Т.к. приложение — тонкая Capacitor-обёртка вокруг реального сайта (а не
нативный SwiftUI/Kotlin код), RevenueCat подключён через официальный
**Capacitor-плагин** (`@revenuecat/purchases-capacitor` +
`@revenuecat/purchases-capacitor-ui`), а не через нативный SDK напрямую —
весь код на TypeScript, тот же React-код, что и веб-версия.

- `src/lib/revenuecat-client.ts` — обёртка над SDK: `configureRevenueCat()`,
  `loginRevenueCat(userId)`/`logoutRevenueCat()`, `getCustomerInfo()`,
  `isProEntitlementActive()`, `presentPaywall()`/`presentPaywallIfNeeded()`,
  `presentCustomerCenter()`, `restorePurchases()`. Все функции — no-op на
  вебе (`Capacitor.isNativePlatform()` guard), т.к. веб остаётся на Stripe.
- `src/hooks/useRevenueCat.ts` — React-хук, конфигурирует SDK при монтировании,
  логинит текущего пользователя, слушает `CustomerInfoUpdateListener` для
  live-обновлений статуса.
- `src/components/subscription/NativeSubscriptionPanel.tsx` — готовая
  UI-панель (статус PRO, кнопка апгрейда/Customer Center/restore) —
  рендерится только в native-приложении, на вебе возвращает `null`.
- `src/app/api/webhooks/revenuecat/route.ts` — серверный вебхук, синхронизирует
  события стора в единую модель `Subscription` (см. схему в `prisma/schema.prisma`).

**Entitlement ID**: `rusofácilapp_pro` (см. `PRO_ENTITLEMENT_ID` в
`revenuecat-client.ts`) — должен быть создан в дашборде RevenueCat под
этим именем.

**Продукты**: `lifetime` / `yearly` / `monthly` настраиваются в двух
местах, не в коде — (1) App Store Connect / Google Play Console как
реальные in-app-продукты (позже, после верификации аккаунта), (2)
RevenueCat dashboard: Products → привязать к тем же store product ID →
включить в Offering "default" как Packages. `REVENUECAT_PRODUCT_MONTHLY`/
`ANNUAL`/`LIFETIME` в `.env` — только для маппинга события вебхука на наш
внутренний plan id, самих продуктов не создают. `lifetime` — это
one-time non-consumable (не подписка): не имеет `RENEWAL`/`EXPIRATION`,
доступ выдаётся навсегда — см. `LIFETIME_PERIOD_END` в
`src/app/api/webhooks/revenuecat/route.ts`.

**Env-переменные** (`.env.example`):
- `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY` / `_ANDROID_API_KEY` — публичные
  SDK-ключи (безопасно зашивать в бинарник, как Stripe publishable key),
  из дашборда RevenueCat → App settings → API Keys. iOS-ключ уже задан
  локально (`test_...`, sandbox-режим); Android-ключ пока пуст.
- `REVENUECAT_WEBHOOK_SECRET`, `REVENUECAT_PRODUCT_MONTHLY/ANNUAL/LIFETIME` —
  серверные, см. `.env.example`. Локально уже заполнены тестовыми product
  ID, совпадающими с `.storekit`-файлом ниже.

**После установки/обновления плагинов** — обязательно `npm run cap:sync`
(обновляет `Package.swift` для iOS и Gradle-зависимости для Android).

### Локальное тестирование покупок без верификации Apple — StoreKit Configuration File

Ключевой факт: **Xcode может полностью эмулировать App Store прямо в
Simulator** — ни аккаунт разработчика, ни App Store Connect, ни
sandbox-тестер для этого не нужны. RevenueCat SDK работает с этими
локальными транзакциями точно так же, как с настоящими (StoreKit 2 не
делает разницы на уровне SDK), включая выдачу энтайтлмента и показ
Paywall — так что весь флоу покупки можно обкатать уже сейчас, пока
Apple/Google ещё проверяют аккаунты.

Файл конфигурации уже создан: **`ios/App/App/RusoFacilappPRO.storekit`**
— 3 продукта, идентификаторы совпадают с `.env`:

| Package (RC) | Product ID | Тип | Цена (тест) |
|---|---|---|---|
| `monthly` | `com.rusofacilapp.app.pro.monthly` | Auto-renewable, 1 месяц | $7.99 |
| `yearly` | `com.rusofacilapp.app.pro.yearly` | Auto-renewable, 1 год, та же subscription group | $47.99 |
| `lifetime` | `com.rusofacilapp.app.pro.lifetime` | Non-consumable | $49.99 |

**Что нужно сделать в Xcode (руками, GUI-шаг, автоматизировать нельзя):**
1. `npm run cap:ios` — откроет проект в Xcode.
2. Файл `RusoFacilappPRO.storekit` уже лежит в `ios/App/App/` — если Xcode
   не подхватил его сам, добавьте через правый клик на группу **App** →
   *Add Files to "App"…* → выберите файл (без копирования, он уже на месте).
3. **Product → Scheme → Edit Scheme… → Run → Options** → в выпадающем
   списке **StoreKit Configuration** выберите `RusoFacilappPRO`.
4. Запустите приложение в симуляторе (▶️) — теперь `Purchases.getOfferings()`
   и Paywall будут видеть эти 3 продукта локально.

**Что нужно сделать в дашборде RevenueCat (не требует верификации Apple —
это отдельный аккаунт):**
1. Apps → создать iOS-приложение с bundle ID `com.rusofacilapp.app` (можно
   до подключения реального App Store Connect — метаданные/цены просто не
   подтянутся автоматически, это не мешает тестированию).
2. Entitlements → создать `rusofácilapp_pro`.
3. Products → добавить вручную все 3 identifier из таблицы выше (RC
   позволяет ввести product ID без синхронизации с App Store Connect).
4. Прикрепить все 3 продукта к Entitlement, создать Offering "default" с
   тремя Packages (`monthly`/`yearly`/`lifetime`), назначить "Current".
5. Tools → Paywalls → спроектировать визуал пейволла на этом Offering —
   дизайн можно довести до финального вида уже сейчас, идентификаторы
   продуктов менять не придётся, когда подключится реальный App Store Connect.

**Как проверить, что всё работает**: `presentPaywallIfNeeded()` из
`useRevenueCat()` должен показать спроектированный Paywall, покупка любого
из 3 пакетов должна пройти через локальный StoreKit-лист (без реального
списания денег — это тестовая среда), `isPro` в хуке должен стать `true`
сразу после покупки, `NativeSubscriptionPanel` должен переключиться в
режим "Customer Center". Реальный вебхук `/api/webhooks/revenuecat` в
локальной разработке не получит эти события напрямую (нужен туннель —
ngrok/Vercel — если требуется проверить и серверную синхронизацию, не
только клиентскую выдачу доступа).

**Не сделано (нужен реальный Xcode/Android Studio, здесь недоступны)**:
сам прогон вышеописанного сценария (открыть Xcode, привязать
`.storekit` к схеме, нажать Run), настройка RevenueCat dashboard
(Entitlement/Offering/Products/Paywall — начиная с шага, который требует
вашего логина в RC), создание in-app-продуктов в App Store Connect/Play
Console (только после завершения верификации).
- npm-скрипты: `cap:sync`, `cap:ios`, `cap:android`.

## Известное ограничение

Эта настройка была сделана в среде без Xcode.app/Android Studio — сама
генерация конфигов и нативных проектов проверена (`npx cap add ios/android`
прошли без ошибок, иконки сгенерированы), но **реальная сборка/запуск в
симуляторе не тестировалась** — это первое, что стоит проверить у себя
после установки Xcode/Android Studio.
