// Одна точка правды для трёх РАЗНЫХ имён проекта.
//
// Владелец решил 09.09.2026 (долг 70, половина «б»): совпадать они не
// обязаны, и попытка свести их к одной строке была бы ошибкой, а не
// упрощением.
//
//   SITE_BRAND        — как проект называется на сайте и в текстах.
//   APP_DISPLAY_NAME  — подпись под иконкой в App Store и Google Play и на
//                       домашнем экране телефона. Короче на четыре буквы:
//                       iOS обрезает подпись примерно на 12 знаках, и
//                       «RusoFácilapp» на экране превращается в «RusoFáci…».
//                       Тем же именем зарегистрирован разработчик в Google
//                       Play — оно там уже стоит и не трогается.
//   APP_ID            — идентификатор пакета и bundle id. Строчный, без
//                       диакритики: это адрес, а не имя (долг 70, «а»,
//                       закрыт 09.09.2026 сторожем check:app-id).
//
// ВИТРИННОЕ ИМЯ НЕ МОЖЕТ ЖИТЬ В ОДНОМ МЕСТЕ. Ни Xcode, ни Gradle не
// читают ни этот файл, ни capacitor.config.ts: подпись под иконкой берётся
// из ios/App/App/Info.plist (CFBundleDisplayName, CFBundleName) и из
// android/app/src/main/res/values/strings.xml (app_name,
// title_activity_main) в момент нативной сборки. `npx cap sync` эти поля
// НЕ переписывает — appName из capacitor.config.ts используется только
// один раз, при `cap add`. Цена: пять литералов в трёх файлах. Она
// выплачена не переписыванием, а сторожем: `npm run check:brand`
// сличает все пять с APP_DISPLAY_NAME ниже и краснеет на любом
// расхождении.
export const SITE_BRAND = "RusoFácilapp";
export const APP_DISPLAY_NAME = "RusoFácil";
export const APP_ID = "com.rusofacilapp.app";
export const SITE_DOMAIN = "rusofacilapp.com";
