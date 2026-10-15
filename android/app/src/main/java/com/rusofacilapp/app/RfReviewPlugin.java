package com.rusofacilapp.app;

import android.content.pm.ApplicationInfo;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.play.core.review.testing.FakeReviewManager;

/**
 * ОКНО ОЦЕНКИ GOOGLE PLAY — официальный In-App Review API (заход 7.266, 1.0.15).
 *
 * Когда просить, решает сайт (`src/lib/app-review.ts`: после третьего
 * успеха, не в первые сутки, не чаще раза в 30 дней, не после покупки).
 * Показывать ли окно, решает Google (квота); ответ не говорит, оценил ли
 * человек, — и это намеренно (правила Google). Своего вопроса перед окном
 * нет.
 *
 * В отладочной сборке — `FakeReviewManager`: настоящего окна на эмуляторе
 * не бывает (только у установленной из Play сборки), а ход вызова виден в
 * журнале (`adb logcat -s RfReview`).
 */
@CapacitorPlugin(name = "RfReview")
public class RfReviewPlugin extends Plugin {
    private static final String TAG = "RfReview";

    @PluginMethod
    public void request(PluginCall call) {
        // BuildConfig в проекте не генерируется — признак отладочной сборки
        // берётся у самого пакета: релиз (AAB из Play) не debuggable.
        boolean debuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        ReviewManager manager = debuggable
            ? new FakeReviewManager(getContext())
            : ReviewManagerFactory.create(getContext());
        Log.i(TAG, "request: manager=" + (debuggable ? "fake" : "play"));
        manager.requestReviewFlow().addOnCompleteListener(request -> {
            if (!request.isSuccessful()) {
                Log.i(TAG, "requestReviewFlow failed");
                JSObject out = new JSObject();
                out.put("launched", false);
                out.put("reason", "request-failed");
                call.resolve(out);
                return;
            }
            ReviewInfo info = request.getResult();
            getActivity().runOnUiThread(() ->
                manager.launchReviewFlow(getActivity(), info).addOnCompleteListener(flow -> {
                    Log.i(TAG, "launchReviewFlow complete: " + flow.isSuccessful());
                    JSObject out = new JSObject();
                    out.put("launched", flow.isSuccessful());
                    call.resolve(out);
                })
            );
        });
    }
}
