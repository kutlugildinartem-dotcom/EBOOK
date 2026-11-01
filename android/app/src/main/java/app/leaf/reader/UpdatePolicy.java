package app.leaf.reader;
import java.net.URI;

/** The updater only accepts APKs published under the owner's fixed HTTPS path. */
public final class UpdatePolicy {
    public static final String MANIFEST = "https://kutlugildinartem-dotcom.github.io/EBOOK/android-update/update.json";
    public static boolean validApkUrl(String value) {
        try { URI uri = new URI(value);
            return "https".equals(uri.getScheme()) && "kutlugildinartem-dotcom.github.io".equals(uri.getHost())
                && (uri.getPort() == -1 || uri.getPort() == 443) && uri.getUserInfo() == null
                && uri.getRawPath().equals(uri.getPath()) && uri.getPath().startsWith("/EBOOK/android-update/")
                && !uri.getPath().contains("..") && uri.getPath().endsWith(".apk")
                && uri.getQuery() == null && uri.getFragment() == null;
        } catch (Exception ignored) { return false; }
    }
    public static boolean validHash(String value) { return value != null && value.matches("[a-fA-F0-9]{64}"); }
    public static boolean newer(long installed, long offered) { return installed > 0 && offered > installed; }
}
