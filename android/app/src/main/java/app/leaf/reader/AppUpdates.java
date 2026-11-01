package app.leaf.reader;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Foreground update checks. Download and Android installation require an explicit user action. */
final class AppUpdates {
    static final int INSTALL_PERMISSION = 42;
    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean();
    private volatile HttpURLConnection connection;
    private ProgressDialog progress;
    private long lastCheck;
    private File pendingApk;
    private volatile boolean cancelledDownload;
    AppUpdates(Activity activity) { this.activity = activity; }
    private void ui(Runnable action) { activity.runOnUiThread(() -> { if (!activity.isFinishing() && !activity.isDestroyed()) action.run(); }); }
    private void toast(String text) { ui(() -> Toast.makeText(activity, text, Toast.LENGTH_LONG).show()); }
    static long version(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private PackageInfo installed() throws Exception { return activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0); }
    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection result = (HttpURLConnection)new URL(url).openConnection();
        result.setConnectTimeout(12000); result.setReadTimeout(20000); result.setUseCaches(false);
        result.setInstanceFollowRedirects(false); result.setRequestProperty("Accept", "application/json, application/octet-stream");
        result.connect(); if (result.getResponseCode() != 200) { int status = result.getResponseCode(); result.disconnect(); throw new IOException("HTTP " + status); }
        connection = result; return result;
    }
    void check(boolean manual) {
        if (!manual && lastCheck != 0 && SystemClock.elapsedRealtime() - lastCheck < 60000) return;
        if (!busy.compareAndSet(false, true)) { if (manual) toast("Обновление уже проверяется или скачивается"); return; }
        lastCheck = SystemClock.elapsedRealtime(); if (manual) toast("Проверяю обновления Leaf…");
        worker.execute(() -> {
            try {
                HttpURLConnection request = open(UpdatePolicy.MANIFEST + "?t=" + System.currentTimeMillis());
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                try (InputStream in = request.getInputStream()) { byte[] data = new byte[4096]; int count; while ((count = in.read(data)) != -1) { if (buffer.size() + count > 32768) throw new IOException("Manifest too large"); buffer.write(data, 0, count); } }
                finally { request.disconnect(); connection = null; }
                JSONObject manifest = new JSONObject(buffer.toString(StandardCharsets.UTF_8.name()));
                long offered = manifest.getLong("versionCode");
                String apkUrl = manifest.getString("apkUrl"), hash = manifest.getString("sha256");
                if (!UpdatePolicy.validApkUrl(apkUrl) || !UpdatePolicy.validHash(hash) || offered < 1) throw new IOException("Invalid update metadata");
                if (!UpdatePolicy.newer(version(installed()), offered)) { if (manual) toast("Установлена последняя версия Leaf " + installed().versionName); return; }
                String name = manifest.optString("versionName", Long.toString(offered));
                String notes = manifest.optString("notes", "Доступна новая версия Leaf. Книги и позиция чтения сохранятся."); if (notes.length() > 700) notes = notes.substring(0, 700);
                final String message = notes;
                ui(() -> new AlertDialog.Builder(activity).setTitle("Обновление Leaf " + name).setMessage(message)
                    .setNegativeButton("Позже", null).setPositiveButton("Скачать и установить", (dialog, which) -> download(apkUrl, hash, offered)).show());
            } catch (Exception error) { if (manual) toast("Не удалось проверить обновления. Проверьте интернет и повторите."); }
            finally { busy.set(false); }
        });
    }
    private void download(String url, String hash, long offered) {
        if (!busy.compareAndSet(false, true)) return;
        cancelledDownload = false;
        progress = new ProgressDialog(activity); progress.setTitle("Обновление Leaf"); progress.setMessage("Скачиваю APK…"); progress.setProgressStyle(ProgressDialog.STYLE_HORIZONTAL); progress.setMax(100); progress.setCancelable(false); progress.setButton(ProgressDialog.BUTTON_NEGATIVE, "Отмена", (dialog, which) -> { cancelledDownload = true; if (connection != null) connection.disconnect(); dismissProgress(); }); progress.show();
        worker.execute(() -> {
            File temp = null;
            try {
                File folder = new File(activity.getCacheDir(), "updates"); if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("No cache directory");
                temp = new File(folder, "Leaf.part"); HttpURLConnection request = open(url); long total = request.getContentLengthLong(), size = 0; int last = -1;
                if (total > 150L * 1024 * 1024) throw new IOException("APK too large");
                try (InputStream in = request.getInputStream(); OutputStream out = new FileOutputStream(temp)) {
                    byte[] data = new byte[65536]; int count;
                    while ((count = in.read(data)) != -1) {
                        if (cancelledDownload || Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
                        size += count; if (size > 150L * 1024 * 1024) throw new IOException("APK too large"); out.write(data, 0, count);
                        int percent = total > 0 ? (int)Math.min(100, size * 100 / total) : 0;
                        if (percent != last) { last = percent; final int value = percent; ui(() -> { if (progress != null) progress.setProgress(value); }); }
                    }
                } finally { request.disconnect(); connection = null; }
                if (!hash.equalsIgnoreCase(sha256(temp))) throw new IOException("Hash mismatch");
                verifyPackage(temp, offered);
                File apk = new File(folder, "Leaf.apk"); if (apk.exists() && !apk.delete()) throw new IOException("Cannot replace cached APK"); if (!temp.renameTo(apk)) throw new IOException("Cannot finish APK");
                pendingApk = apk; ui(() -> { dismissProgress(); installPending(); });
            } catch (Exception error) { if (temp != null) temp.delete(); ui(this::dismissProgress); if (!cancelledDownload) toast("Обновление не установлено: файл не скачался или не прошёл проверку. Повторите позже."); }
            finally { if (connection != null) connection.disconnect(); connection = null; busy.set(false); }
        });
    }
    private void verifyPackage(File apk, long offered) throws Exception {
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageManager manager = activity.getPackageManager(); PackageInfo archive = manager.getPackageArchiveInfo(apk.getAbsolutePath(), flags), current = manager.getPackageInfo(activity.getPackageName(), flags);
        if (archive == null || !activity.getPackageName().equals(archive.packageName) || version(archive) != offered) throw new IOException("Wrong application or version");
        Signature[] old = signatures(current), next = signatures(archive); boolean trusted = false;
        for (Signature a : old) for (Signature b : next) if (Arrays.equals(a.toByteArray(), b.toByteArray())) trusted = true;
        if (!trusted) throw new IOException("Wrong signing certificate");
    }
    private Signature[] signatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= 28 && info.signingInfo != null) return info.signingInfo.getApkContentsSigners();
        return info.signatures == null ? new Signature[0] : info.signatures;
    }
    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); try (InputStream in = new FileInputStream(file)) { byte[] bytes = new byte[65536]; int count; while ((count = in.read(bytes)) != -1) digest.update(bytes, 0, count); }
        StringBuilder value = new StringBuilder(); for (byte b : digest.digest()) value.append(String.format("%02x", b & 255)); return value.toString();
    }
    private void dismissProgress() { if (progress != null) { progress.dismiss(); progress = null; } }
    void installPending() {
        if (pendingApk == null || !pendingApk.isFile()) return;
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            new AlertDialog.Builder(activity).setTitle("Разрешение Android").setMessage("Разрешите Leaf устанавливать обновления на следующем экране, затем вернитесь в приложение.")
                .setNegativeButton("Позже", null).setPositiveButton("Открыть настройки", (dialog, which) -> {
                    try { activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName())), INSTALL_PERMISSION); }
                    catch (Exception error) { toast("Настройку можно открыть в разрешениях приложения Leaf"); }
                }).show(); return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".updates", pendingApk);
            Intent intent = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(intent); pendingApk = null;
        } catch (Exception error) { toast("Не удалось открыть установщик Android"); }
    }
    void permissionResult() { if (activity.getPackageManager().canRequestPackageInstalls()) installPending(); }
    void close() { worker.shutdownNow(); if (connection != null) connection.disconnect(); dismissProgress(); }
}
