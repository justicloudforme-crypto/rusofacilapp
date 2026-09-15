package com.rusofacilapp.app;

import android.animation.ObjectAnimator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.webkit.WebView;
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ДО super.onCreate: androidx требует установить заставку раньше,
        // чем окно получит своё содержимое, а содержимое ставит
        // BridgeActivity внутри super.
        installBrandSplash();
        super.onCreate(savedInstanceState);
        armLoadWatchdog();
        armSafeAreaInsets();
        armSplashRelease();
    }

    /**
     * ЗАСТАВКА ДЕРЖИТСЯ ДО ГОТОВНОСТИ СТРАНИЦЫ, А НЕ ДО ИСТЕЧЕНИЯ СРОКА
     * (заход 7.197, замер владельца 15.09.2026).
     *
     * ЧТО БЫЛО. Заставку показывал плагин `@capacitor/splash-screen`, и
     * показывал её ПО ТАЙМЕРУ: `launchShowDuration: 1500` плюс
     * `launchAutoHide` по умолчанию. Через полторы секунды заставка
     * уходила, а страница ещё не пришла — и оставшиеся секунды человек
     * смотрел на пустой webview. Замер владельца на POCO X6 Pro: 5,9 с
     * от нажатия на иконку до первой картинки. Плюс вторая половина: на
     * Android 12+ плагин рисует заставку СВОЙСТВАМИ ТЕМЫ, а в теме их не
     * было (см. `values/styles.xml`), поэтому и эти полторы секунды были
     * пустыми.
     *
     * ЧТО СТАЛО. Плагин из запуска выведен (`launchShowDuration: 0` в
     * `capacitor.config.ts`), а заставку ставит этот класс напрямую через
     * `androidx.core:core-splashscreen` — ту же библиотеку, которой
     * пользовался плагин. Разница одна и она главная: условие удержания
     * здесь не таймер, а СОБЫТИЕ — страница загрузилась.
     *
     * ПОЧЕМУ ЗДЕСЬ, А НЕ В ВЕБЕ. Обычный способ — позвать
     * `SplashScreen.hide()` из кода страницы. Он здесь не годится:
     * оболочка грузит БОЕВОЙ САЙТ, тот же, что открывает браузер, и
     * заставка — свойство оболочки, а не сайта. Веб этой правкой не
     * тронут ни на байт.
     */
    private void installBrandSplash() {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !splashReleased);
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
            splashReleased = true;
            return;
        }
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                // Самый ранний ЧЕСТНЫЙ момент: webview нарисовал первый
                // кадр содержимого. Держать заставку дольше значило бы
                // прятать уже готовую страницу.
                splashReleased = true;
            }

            @Override
            public void onPageLoaded(WebView view) {
                splashReleased = true;
            }

            @Override
            public void onReceivedError(WebView view) {
                // Ошибку показывает `server.errorPath`; заставке над ней
                // стоять нечего.
                splashReleased = true;
            }
        });
        loadWatchdog.postDelayed(() -> splashReleased = true, LOAD_TIMEOUT_MS);
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
     * ГРАНИЦА ЧЕСТНОСТИ. Java здесь не исполняется ничем, что есть на
     * машине сборки (долг 176 про это и заведён), поэтому проверяется это
     * глазами на телефоне владельца, а статика — сторожем
     * `npm run check:native-shell`.
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
        String js =
            "(function(){var s=document.documentElement.style;" +
            "s.setProperty('--android-inset-top','" + insetTop + "px');" +
            "s.setProperty('--android-inset-bottom','" + insetBottom + "px');" +
            "s.setProperty('--android-inset-left','" + insetLeft + "px');" +
            "s.setProperty('--android-inset-right','" + insetRight + "px');})()";
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

    @Override
    public void onDestroy() {
        if (pendingCheck != null) {
            loadWatchdog.removeCallbacks(pendingCheck);
            pendingCheck = null;
        }
        super.onDestroy();
    }
}
