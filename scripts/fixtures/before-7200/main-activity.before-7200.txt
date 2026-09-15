package com.rusofacilapp.app;

import android.animation.ObjectAnimator;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.LinearInterpolator;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * СТОРОЖ ЗАГРУЗКИ (заход 7.189, долг 175).
 *
 * Оболочка не несёт сайт внутри себя — она грузит боевой адрес удалённо.
 * Отсюда отказ, которого у обычного сайта нет: у приложения нет ни адресной
 * строки, ни кнопки «обновить», ни вкладки, которую можно закрыть. Если
 * первый запрос не доехал, у ученика остаётся белый прямоугольник и ничего
 * больше — ни текста, ни кнопки, ни объяснения.
 *
 * Половину этого Capacitor закрывает сам: `server.errorPath` в
 * `capacitor.config.ts` показывает `capacitor-shell/error.html`, когда
 * webview получает ОШИБКУ (`BridgeWebViewClient.onReceivedError` и
 * `onReceivedHttpError`) — нет сети, не разобралось имя, сервер ответил 5xx.
 *
 * Вторую половину Capacitor не закрывает вовсе, и именно она страшнее:
 * сервер не отказал, а МОЛЧИТ. Тогда ошибки нет, `errorPath` не срабатывает
 * ни разу, и белый экран живёт столько, сколько человек согласен ждать.
 * Этот класс мы уже видели у самих себя — инцидент №1: HTTP 200, правильный
 * HTML, пустой экран.
 *
 * Поэтому здесь стоит таймер. Он заводится один раз при создании окна и
 * через {@link #LOAD_TIMEOUT_MS} спрашивает у webview ровно два факта:
 * дошла ли загрузка до конца и нарисовалось ли хоть что-то. Если нет —
 * грузит локальный экран ошибки, тот же самый, что показывает `errorPath`.
 * Двух фактов, а не одного: `getProgress() == 100` бывает и у пустого
 * документа (сервер ответил 200 и пустым телом), а `getContentHeight() == 0`
 * бывает на середине честной загрузки.
 *
 * ГРАНИЦА ЧЕСТНОСТИ. Ни одна строка этого файла на живом устройстве не
 * проверялась: Java здесь не исполняется ничем, что есть на машине сборки,
 * а `adb install` на телефон владельца падает (долг 112, долг 170). Статика
 * стережётся `npm run check:native-shell`; проверку глазами на телефоне
 * держит отдельный долг 176.
 */
public class MainActivity extends BridgeActivity {

    /**
     * Сколько ждать, прежде чем признать загрузку несостоявшейся.
     *
     * Двенадцать секунд — не круглое число «на всякий случай», а запас над
     * замеренным: время ответа боевого прода на `/api/word-audio` в 7.187
     * было 0,32…0,66 с, а полная отрисовка страницы в прогоне
     * `check:rendered` укладывается в единицы секунд. Ставить меньше опасно
     * в обратную сторону: мобильная сеть в метро отдаёт первую страницу и за
     * восемь секунд, и показать ей экран ошибки значило бы сломать рабочий
     * запуск. Ставить больше бессмысленно — человек к этому времени уже
     * решил, что приложение не работает.
     */
    private static final long LOAD_TIMEOUT_MS = 12_000L;

    private final Handler loadWatchdog = new Handler(Looper.getMainLooper());
    private Runnable pendingCheck;

    /**
     * Последние измеренные системные полосы в CSS-пикселях. Держатся
     * полем, потому что источников события два и они независимы: полосы
     * меняются сами (поворот, жестовая навигация, разделённый экран), а
     * страница сменяется переходом — и после каждого перехода документ
     * новый, со своими пустыми переменными.
     */
    private int insetTop, insetBottom, insetLeft, insetRight;

    /**
     * Заставка ушла (или ей велено уйти). Читается из условия удержания,
     * которое система спрашивает на каждой отрисовке.
     */
    private volatile boolean splashReleased = false;

    /** Сколько длится уход заставки. Не «пока грузится», а именно уход:
     *  мгновенная подмена знака на страницу читается как рывок. */
    private static final long SPLASH_FADE_MS = 220L;

    /** Поле знака заставки в dp. Число платформы, не наше: системная
     *  заставка Android 12+ кладёт `windowSplashScreenAnimatedIcon` ровно
     *  в такое поле, и `scripts/store-assets/generate-splash.mjs` рисует
     *  `splash_icon.png` под него же (`SPLASH_ICON_DP`). Наш слой обязан
     *  повторять эту геометрию знак в знак — иначе подмена системной
     *  заставки нашей будет видна рывком размера. Сличается сторожем
     *  `npm run check:splash`. */
    private static final int SPLASH_ICON_DP = 288;

    /** Наш собственный слой заставки. Существует, пока страница не готова. */
    private View brandSplashOverlay;

    /** Наш слой прикреплён к окну — значит первый же кадр окна фирменный,
     *  и держать над ним системную заставку больше незачем. */
    private volatile boolean overlayAttached = false;

    /**
     * ПАМЯТЬ ОБОЛОЧКИ О ЯЗЫКЕ (заход 7.198, части 3 и 4).
     *
     * Здесь живёт РОВНО ОДНО значение — локаль последней открытой
     * страницы, `es` или `ru`. Не настройка и не выбор пользователя:
     * выбор делается на сайте, а сюда попадает его СЛЕД. Читателей два, и
     * оба — вне сайта: экран ошибки оболочки (у него нет ни словаря, ни
     * доступа к кукам боевого источника, потому что загружен он с
     * `https://localhost`) и решение о том, что вообще открывать при
     * следующем запуске.
     *
     * Почему не кука. Кука — правильное место для первого читателя, и
     * именно она и заведена на сайте (`src/lib/remembered-locale.ts`,
     * `src/proxy.ts`): корневой адрес `https://rusofacilapp.com/`
     * приводит оболочку сразу на запомненную локаль, и это работает
     * одинаково в приложении и в браузере. Но экран ошибки живёт на
     * ДРУГОМ источнике и куки боевого домена не видит вовсе — ни одной.
     * Поэтому здесь второй экземпляр того же факта, и он осознанный.
     */
    private static final String PREFS = "rf-shell";
    private static final String PREF_LOCALE = "lastLocale";

    /**
     * ПОДСТАНОВКА БЕЗОПАСНЫХ ПОЛЕЙ — ОДНА СТРОКА НА ВЕСЬ ПРОЕКТ.
     *
     * Здесь она объявлена шаблоном, а не собирается по месту, потому что
     * её читает и ИСПОЛНЯЕТ сторож `npm run check:safe-area-insets`: он
     * достаёт этот литерал из файла текстом, подставляет числа и гоняет
     * его в настоящем браузере против настоящих страниц сайта. Сторож,
     * написавший свою копию этой строки, проверял бы свою копию.
     *
     * ДВЕ ЗАПИСИ, И ВТОРАЯ — ГЛАВНАЯ (заход 7.198, часть 2).
     *
     * Первая запись — в `style` элемента `<html>`. Так было с 7.192, и
     * замер 15.09.2026 показал, чего она стоит: при смене языка её
     * СТИРАЕТ React. Событий `load` за этот переход ноль — то есть полной
     * навигации нет вовсе и версия «поля не подставляются заново после
     * перезагрузки» неверна; документ тот же самый, а атрибут `style` у
     * `<html>` React переписывает целиком, когда меняется параметр
     * корневого макета (`src/app/[lang]/layout.tsx`, `<html lang={lang}>`).
     * Измерено: `--safe-top` до перехода `max(0px, 27px)`, после —
     * `max(0px, 0px)`; на переходе внутри локали он остаётся 27px.
     *
     * Вторая запись — `adoptedStyleSheets`. Это лист стилей ВНЕ дерева
     * документа: у него нет узла, его нельзя «перерисовать» и React до
     * него не дотягивается ни при каком переходе. Он и держит поля через
     * любую мягкую навигацию. Полную навигацию не переживает ни одна из
     * двух записей — там документ действительно новый, — и там их
     * восстанавливают `onPageStarted` и `onPageLoaded`, как и раньше.
     *
     * Первая запись оставлена, а не заменена: конструируемые листы стилей
     * есть не во всяком WebView, и на старом устройстве вторая запись
     * просто не выполнится (она в `try`), а первая сработает.
     */
    private static final String INSET_APPLY_JS =
        "(function(t,b,l,r){" +
        "var v={'--android-inset-top':t+'px','--android-inset-bottom':b+'px'," +
        "'--android-inset-left':l+'px','--android-inset-right':r+'px'};" +
        "var s=document.documentElement.style;" +
        "for(var k in v){s.setProperty(k,v[k]);}" +
        "try{" +
        "var txt=':root{';for(var k2 in v){txt+=k2+':'+v[k2]+';';}txt+='}';" +
        "var sheet=window.__rfInsetSheet;" +
        "if(!sheet){sheet=new CSSStyleSheet();window.__rfInsetSheet=sheet;" +
        "document.adoptedStyleSheets=document.adoptedStyleSheets.concat([sheet]);}" +
        "sheet.replaceSync(txt);" +
        "}catch(e){}" +
        "})(%TOP%,%BOTTOM%,%LEFT%,%RIGHT%)";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ДО super.onCreate: androidx требует установить заставку раньше,
        // чем окно получит своё содержимое, а содержимое ставит
        // BridgeActivity внутри super.
        installBrandSplash();
        super.onCreate(savedInstanceState);
        attachBrandSplashOverlay();
        armLoadWatchdog();
        armSafeAreaInsets();
        armRememberedLocale();
        armSplashRelease();
    }

    /**
     * ЗНАК ЗАСТАВКИ ОБЯЗАН БЫТЬ ПРИ ЛЮБОМ СПОСОБЕ ЗАПУСКА (заход 7.198,
     * часть 4, замер владельца 15.09.2026).
     *
     * ЧТО ИЗМЕРЕНО. Одна и та же сборка 7.197, два запуска, покадрово:
     * с иконки — синий фон и матрёшка с первого кадра; кнопкой «Открыть»
     * из установщика сразу после установки — синий фон и НИ ОДНОГО кадра
     * со знаком, 4,2 с сплошного цвета.
     *
     * ЧТО ЭТО ОПРОВЕРГАЕТ. Обе версии владельца были про тему запуска:
     * «система ещё не применила тему» и «активность поднимается из
     * другого намерения, и тема запуска не та». Обе неверны, и опровергает
     * их сам кадр: фон БЫЛ синий, #2d5f8a. Этот цвет в приложении
     * существует ровно в одном месте — `windowSplashScreenBackground`
     * темы `AppTheme.NoActionBarLaunch` (`values/styles.xml`). Не
     * примени система эту тему — фон был бы не синий, а светлый фон
     * `AppTheme`. Значит тема применена, и применена ТА САМАЯ: активность
     * в манифесте одна, `intent-filter` у неё один, другого способа её
     * поднять нет вовсе (перепись — `npm run check:splash-launch`).
     *
     * ЧТО ОСТАЁТСЯ. Фон применён, а знак — нет. Ровно эту пару даёт
     * `SPLASH_SCREEN_STYLE_EMPTY`: стиль системной заставки, который
     * запрашивает ВЫЗЫВАЮЩЕЕ приложение через
     * `ActivityOptions.setSplashScreenStyle`, и при котором система рисует
     * фон темы без значка. Установщик пакетов и Play Store запускают
     * приложение именно так — у них своя анимация перехода от карточки
     * магазина, и значок системной заставки её бы разорвал. Запуск с
     * иконки идёт без этих опций и значок получает. Отсюда и два разных
     * кадра у ОДНОЙ сборки.
     *
     * ЧИНИТСЯ НЕ ТЕМОЙ. Стиль заставки выбирает ЧУЖОЕ приложение, и ни
     * одна строка нашей темы этого выбора не отменяет. Поэтому знак рисуем
     * МЫ САМИ: слой ниже — часть окна нашей активности, он есть в первом
     * же её кадре и не зависит ни от намерения, ни от опций запуска, ни от
     * версии Android. Системная заставка при этом больше ничего не держит:
     * условие её удержания снимается в тот момент, когда наш слой
     * прикреплён, — то есть она уходит, открывая точно такую же картинку.
     * Геометрия совпадает намеренно (то же поле {@link #SPLASH_ICON_DP},
     * тот же `@drawable/splash_icon`, тот же `@color/splashBackground`):
     * подмена обязана быть незаметной.
     */
    private void installBrandSplash() {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        // Условие держит системную заставку ровно до того мига, когда наш
        // слой прикреплён к окну. Не «пока страница грузится»: страницу
        // теперь ждёт НАШ слой, и ждать её обоими значило бы показать
        // пустой кадр между их сменой на том запуске, где системная
        // заставка пустая.
        splash.setKeepOnScreenCondition(() -> !overlayAttached);
        splash.setOnExitAnimationListener(provider -> {
            ObjectAnimator fade = ObjectAnimator.ofFloat(provider.getView(), View.ALPHA, 1f, 0f);
            fade.setInterpolator(new LinearInterpolator());
            fade.setDuration(SPLASH_FADE_MS);
            fade.addListener(new android.animation.AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(android.animation.Animator animation) {
                    provider.remove();
                }
            });
            fade.start();
        });
    }

    /** Кладёт фирменный слой поверх содержимого окна. Синхронно в
     *  `onCreate`, чтобы он попал в ПЕРВЫЙ кадр окна, а не во второй. */
    private void attachBrandSplashOverlay() {
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null) {
            // Держать системную заставку не на чем: без содержимого окна
            // нашему слою некуда встать.
            overlayAttached = true;
            return;
        }
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(getColor(R.color.splashBackground));
        // Слой перехватывает нажатия: пока он на экране, под ним уже может
        // быть отрисована страница, и тап «сквозь заставку» был бы тапом
        // вслепую.
        overlay.setClickable(true);
        overlay.setFocusable(true);

        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.splash_icon);
        mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        int side = Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, SPLASH_ICON_DP, getResources().getDisplayMetrics()));
        FrameLayout.LayoutParams markParams = new FrameLayout.LayoutParams(side, side);
        markParams.gravity = Gravity.CENTER;
        overlay.addView(mark, markParams);

        content.addView(overlay, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        brandSplashOverlay = overlay;
        overlayAttached = true;
    }

    /** Убирает фирменный слой тем же уходом, что был у системной заставки. */
    private void hideBrandSplashOverlay() {
        final View overlay = brandSplashOverlay;
        if (overlay == null) {
            return;
        }
        brandSplashOverlay = null;
        overlay.post(() -> {
            ObjectAnimator fade = ObjectAnimator.ofFloat(overlay, View.ALPHA, 1f, 0f);
            fade.setInterpolator(new LinearInterpolator());
            fade.setDuration(SPLASH_FADE_MS);
            fade.addListener(new android.animation.AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(android.animation.Animator animation) {
                    ViewGroup parent = (ViewGroup) overlay.getParent();
                    if (parent != null) {
                        parent.removeView(overlay);
                    }
                }
            });
            fade.start();
        });
    }

    /**
     * ДВА ВЫХОДА ИЗ ЗАСТАВКИ, И ВТОРОЙ ОБЯЗАТЕЛЕН.
     *
     * Первый — страница загрузилась: `onPageLoaded` webview. Это нормаль.
     *
     * Второй — ПРЕДОХРАНИТЕЛЬ. Событие загрузки может не прийти вовсе:
     * сервер молчит, сеть отвалилась на середине ответа, webview ждёт
     * первого байта. Без второго выхода человек остался бы наедине с
     * логотипом навсегда — то есть тем же белым экраном, только
     * фирменным. Поэтому срок стоит тот же самый, что у сторожа загрузки
     * ({@link #LOAD_TIMEOUT_MS}), и это НЕ два независимых числа: сторож
     * в ту же секунду грузит уже существующий экран ошибки с кнопкой
     * «Повторить» (заход 7.189), а заставка уходит и открывает его.
     * Разойдись они — человек увидел бы между ними пустоту.
     */
    private void armSplashRelease() {
        if (getBridge() == null) {
            // Моста нет — держать заставку не на чем и не для чего.
            releaseSplash();
            return;
        }
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                // Самый ранний ЧЕСТНЫЙ момент: webview нарисовал первый
                // кадр содержимого. Держать заставку дольше значило бы
                // прятать уже готовую страницу.
                releaseSplash();
            }

            @Override
            public void onPageLoaded(WebView view) {
                releaseSplash();
            }

            @Override
            public void onReceivedError(WebView view) {
                // Ошибку показывает `server.errorPath`; заставке над ней
                // стоять нечего.
                releaseSplash();
            }
        });
        loadWatchdog.postDelayed(() -> releaseSplash(), LOAD_TIMEOUT_MS);
    }

    /** Идемпотентно: выходов из заставки четыре (первый кадр содержимого,
     *  конец загрузки, ошибка, предохранитель), и прийти они могут в любом
     *  порядке. Второй уход анимировал бы уже снятый слой. */
    private void releaseSplash() {
        if (splashReleased) {
            return;
        }
        splashReleased = true;
        hideBrandSplashOverlay();
    }

    /**
     * БЕЗОПАСНЫЕ ПОЛЯ СВЕРХУ И СНИЗУ (заход 7.192, долг 180).
     *
     * Почему это вообще понадобилось. У приложения targetSdk 36, а с
     * Android 15 система рисует окно во весь экран и отказаться от этого
     * нельзя: `windowOptOutEdgeToEdgeEnforcement` на targetSdk 36 система
     * игнорирует (это написано прямым текстом в README
     * `@capacitor/status-bar`, и там же сказано, что по той же причине
     * перестали работать `overlaysWebView` и `backgroundColor`). Значит
     * webview занимает экран целиком, вместе с полосой часов сверху и
     * полосой кнопок снизу, и содержимое лезет под обе. Замер владельца на
     * POCO X6 Pro (Android 16, сборка 7191): плашка «нет соединения» под
     * часами, нижняя навигация под системными кнопками — в кадре только её
     * край, последние строки обычных страниц срезаны.
     *
     * Почему этого не сделать стилями. `env(safe-area-inset-*)` в webview
     * отвечает про ВЫРЕЗ экрана, а не про системные полосы: в этом режиме
     * он остаётся нулём, и `pt-safe`/`pb-safe`, которые в проекте уже
     * стоят везде, где надо, получают ноль и не делают ничего.
     *
     * Что сделано. Величины полос читаются у системы и кладутся в те же
     * переменные, из которых страница их и берёт (см. `--android-inset-*`
     * в `src/app/globals.css`): CSS берёт `max()` от выреза и от этих
     * значений, поэтому ни одна из двух величин не теряется и двойного
     * счёта нет.
     *
     * Отступ ставится СТРАНИЦЕ, а не webview. Прижми мы полосы паддингом
     * самого webview — область под часами красилась бы фоном самого
     * webview, одним на все три темы сайта (светлую, тёмную, «чтение»), и
     * у двух из трёх получилась бы чужая полоса сверху. Так же, как и
     * везде в этом приложении, полосу закрывает собой непрозрачная шапка
     * сайта.
     *
     * ЧТО ДОБАВЛЕНО 15.09.2026 (7.198, часть 2). Записей теперь две, и
     * причина — в шапке {@link #INSET_APPLY_JS}: одной записи в `style`
     * элемента `<html>` не хватало, её стирал React на смене языка.
     *
     * ГРАНИЦА ЧЕСТНОСТИ. Java здесь не исполняется ничем, что есть на
     * машине сборки (долг 176 про это и заведён), поэтому проверяется это
     * глазами на телефоне владельца, а САМА ПОДСТАНОВКА — сторожем
     * `npm run check:safe-area-insets`, который достаёт её текстом из
     * этого файла и исполняет в настоящем браузере.
     */
    private void armSafeAreaInsets() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) {
            return;
        }
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            float density = getResources().getDisplayMetrics().density;
            insetTop = Math.round(bars.top / density);
            insetBottom = Math.round(bars.bottom / density);
            insetLeft = Math.round(bars.left / density);
            insetRight = Math.round(bars.right / density);
            pushSafeAreaInsets();
            // Insets НЕ поглощаются: их читает ещё и сам webview, и
            // поглотить их значило бы отобрать вырез у `env()`.
            return windowInsets;
        });
        // Переход стирает переменные вместе со старым документом, поэтому
        // они ставятся заново на КАЖДОЙ странице — и в начале загрузки, и
        // в конце. В начале, чтобы первый же нарисованный кадр был с
        // отступом; в конце — потому что на самом начале документа может
        // ещё не быть.
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView view) {
                pushSafeAreaInsets();
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                pushSafeAreaInsets();
            }

            @Override
            public void onPageLoaded(WebView view) {
                pushSafeAreaInsets();
            }
        });
    }

    /** Кладёт последние измеренные величины в CSS-переменные документа. */
    private void pushSafeAreaInsets() {
        if (getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        String js = INSET_APPLY_JS
            .replace("%TOP%", String.valueOf(insetTop))
            .replace("%BOTTOM%", String.valueOf(insetBottom))
            .replace("%LEFT%", String.valueOf(insetLeft))
            .replace("%RIGHT%", String.valueOf(insetRight));
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    /**
     * ЯЗЫК ЭКРАНА ОШИБКИ — ТОТ ЖЕ, ЧТО У ПОСЛЕДНЕЙ СТРАНИЦЫ (заход 7.198,
     * часть 3 «б»).
     *
     * Что было. `capacitor-shell/error.html` выбирал язык по
     * `navigator.language`, то есть по языку ТЕЛЕФОНА. У владельца
     * телефон испанский, а интерфейс сайта переключён на русский — и
     * экран ошибки приходил на испанском. Это тот же класс, что замер
     * 7.195 про язык уведомлений: язык берётся откуда придётся, потому
     * что единственного места для него нет.
     *
     * Что стало. Оболочка запоминает локаль КАЖДОЙ открытой страницы (она
     * первым сегментом адреса: `/es/…`, `/ru/…`) и кладёт её в
     * {@link #PREFS}. Когда на экране оказывается локальный экран ошибки,
     * оболочка называет ему эту локаль — экран ошибки принимает её через
     * `window.__rfApplyLocale`, объявленный в самом `error.html`.
     *
     * Почему через вызов, а не через адрес с параметром. Экран ошибки
     * показывает не только наш сторож загрузки, но и сам Capacitor
     * (`server.errorPath`), и его адрес мы не строим — он приходит из
     * `Bridge.getErrorUrl()`. Значит признак обязан доезжать ПОСЛЕ
     * загрузки, а не в адресе, иначе одна из двух дорог осталась бы без
     * языка.
     */
    private void armRememberedLocale() {
        if (getBridge() == null) {
            return;
        }
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView view) {
                rememberLocaleFrom(view.getUrl());
            }

            @Override
            public void onPageCommitVisible(WebView view, String url) {
                rememberLocaleFrom(url);
                applyLocaleToErrorScreen(url);
            }

            @Override
            public void onPageLoaded(WebView view) {
                rememberLocaleFrom(view.getUrl());
                applyLocaleToErrorScreen(view.getUrl());
            }
        });
    }

    /** Первый сегмент пути боевого адреса — это локаль, и других значений
     *  у неё нет: список сличается сторожем с `src/i18n/config.ts`. */
    private void rememberLocaleFrom(String url) {
        String locale = localeOf(url);
        if (locale == null) {
            return;
        }
        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (locale.equals(prefs.getString(PREF_LOCALE, null))) {
            return;
        }
        prefs.edit().putString(PREF_LOCALE, locale).apply();
    }

    private String localeOf(String url) {
        if (url == null) {
            return null;
        }
        String path;
        try {
            path = Uri.parse(url).getPath();
        } catch (Exception e) {
            return null;
        }
        if (path == null) {
            return null;
        }
        if (path.equals("/es") || path.startsWith("/es/")) {
            return "es";
        }
        if (path.equals("/ru") || path.startsWith("/ru/")) {
            return "ru";
        }
        return null;
    }

    private void applyLocaleToErrorScreen(String url) {
        if (getBridge() == null || url == null) {
            return;
        }
        String errorUrl = getBridge().getErrorUrl();
        if (errorUrl == null || !url.startsWith(errorUrl)) {
            return;
        }
        String locale = getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(PREF_LOCALE, null);
        if (locale == null) {
            // Ничего не запомнено — прежнее поведение экрана ошибки
            // (язык телефона, запасной испанский). Это ПЕРВЫЙ запуск,
            // у которого другого источника и нет.
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        String js = "if(window.__rfApplyLocale)window.__rfApplyLocale('" + locale + "')";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    private void armLoadWatchdog() {
        pendingCheck = new Runnable() {
            @Override
            public void run() {
                if (getBridge() == null) {
                    return;
                }
                WebView webView = getBridge().getWebView();
                String errorUrl = getBridge().getErrorUrl();
                // Без errorPath в конфиге показывать нечего, и тогда лучше
                // оставить как есть, чем грузить пустоту поверх пустоты.
                if (webView == null || errorUrl == null) {
                    return;
                }
                String current = webView.getUrl();
                // Экран ошибки уже на месте — второй раз грузить его значит
                // стереть у человека нажатие «Повторить».
                if (current != null && current.startsWith(errorUrl)) {
                    return;
                }
                boolean finished = webView.getProgress() >= 100;
                boolean painted = webView.getContentHeight() > 0;
                if (finished && painted) {
                    return;
                }
                webView.stopLoading();
                webView.loadUrl(errorUrl);
            }
        };
        loadWatchdog.postDelayed(pendingCheck, LOAD_TIMEOUT_MS);
    }

    /**
     * ВЫХОД ИЗ АККАУНТА ОБЯЗАН ПЕРЕЖИТЬ ЗАКРЫТИЕ ПРИЛОЖЕНИЯ (заход 7.198,
     * часть 1).
     *
     * ЖАЛОБА. Выход → экран входа → закрыть из «Недавних» → открыть с
     * иконки → приложение открылось ПОД АККАУНТОМ.
     *
     * ЧТО ИЗМЕРЕНО, И ЧТО ЭТО ОПРОВЕРГАЕТ. Обе версии владельца проверены
     * числом:
     *
     *   (а) «кука не удаляется» — половина неверна. Ответ боевого сервера
     *       на `POST /api/auth/logout` снят 15.09.2026:
     *       `set-cookie: session=; Path=/; Expires=Thu, 01 Jan 1970 …`.
     *       Путь `/` тот же, что у выданной куки, — то есть сервер просит
     *       удалить ровно ту куку и просит правильно.
     *   (б) «страница пришла из кеша воркера» — не объясняет ЭТОТ случай.
     *       Страницы у воркера обслуживаются `NetworkFirst`
     *       (`src/app/sw.ts`): при живой сети побеждает сеть, и сервер без
     *       куки нарисовал бы гостя. Больше того, последняя копия
     *       стартовой страницы, попавшая в кеш, — это ГОСТЕВАЯ страница,
     *       на которую увёл сам выход. (Дефект в (б) всё-таки есть, он
     *       другой и чинится отдельно на стороне сайта: в кеше остаются
     *       ЛИЧНЫЕ страницы прежнего пользователя, и офлайн они видны.)
     *
     * ЧТО ОСТАЁТСЯ, И ЭТО ЗДЕСЬ. Удаление куки, о котором просит сервер,
     * доезжает до webview и живёт в ПАМЯТИ. На диск хранилище кук
     * Chromium пишет пачками — по таймеру, а не по каждой правке, — и
     * закрытие приложения из «Недавних» в первые же секунды после выхода
     * убивает процесс раньше записи. При следующем запуске WebView
     * поднимает куки С ДИСКА, где лежит ещё старая сессия, и сервер
     * законно признаёт её своей. Это объясняет и то, почему ВХОД
     * переживает перезапуск: между входом и закрытием проходят минуты.
     *
     * Перепись вызовов: `CookieManager.flush()` в жизненном цикле
     * Capacitor 8.5.0 не зовётся НИ РАЗУ (`Bridge.onPause`,
     * `Bridge.onStop`, `Bridge.onDestroy` — прочитаны целиком, ноль
     * совпадений). То есть эту запись не делает никто.
     *
     * Строка ниже — та самая запись. `onPause` и `onStop` система вызывает
     * ДО того, как человек смахнёт карточку из «Недавних», поэтому
     * замеренный сценарий она закрывает целиком. Чего она не закрывает и
     * это названо честно: падение процесса в переднем плане сразу после
     * выхода — там `onPause` не будет вовсе.
     *
     * Держится сторожем `npm run check:native-cookie-flush`, у которого
     * есть положительный контроль на НАСТОЯЩЕМ старом файле: на версии
     * этого класса до правки он обязан упасть.
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onDestroy() {
        if (pendingCheck != null) {
            loadWatchdog.removeCallbacks(pendingCheck);
            pendingCheck = null;
        }
        CookieManager.getInstance().flush();
        super.onDestroy();
    }
}
