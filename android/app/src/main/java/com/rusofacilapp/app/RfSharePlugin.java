package com.rusofacilapp.app;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * «COMPARTIR» — СИСТЕМНОЕ ОКНО «ПОДЕЛИТЬСЯ» ANDROID (заход 7.266, оболочка 1.0.15).
 *
 * В WebView нет `navigator.share`, поэтому сайт (`src/lib/share-app.ts`)
 * зовёт этот плагин. Делает ровно одно: отдаёт текст со ссылкой системному
 * окну выбора приложения (`Intent.ACTION_SEND`, `text/plain`). Ничего не
 * читает, ничего не отправляет сам, разрешений не требует: куда уйдёт
 * текст, выбирает человек в окне Android.
 */
@CapacitorPlugin(name = "RfShare")
public class RfSharePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        String text = call.getString("text", "");
        String title = call.getString("title", "");
        if (text == null || text.isEmpty()) {
            call.reject("text is empty");
            return;
        }
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_TITLE, title);
        Intent chooser = Intent.createChooser(send, title);
        try {
            getActivity().startActivity(chooser);
            call.resolve(new JSObject());
        } catch (Exception e) {
            call.reject("share failed", e);
        }
    }
}
