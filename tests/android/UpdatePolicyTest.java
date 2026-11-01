import app.leaf.reader.UpdatePolicy;
public final class UpdatePolicyTest {
    public static void main(String[] args) {
        assert UpdatePolicy.validApkUrl("https://kutlugildinartem-dotcom.github.io/EBOOK/android-update/Leaf.apk");
        for (String bad : new String[]{"http://kutlugildinartem-dotcom.github.io/EBOOK/android-update/Leaf.apk","https://evil.example/Leaf.apk","https://kutlugildinartem-dotcom.github.io/Other/Leaf.apk","https://kutlugildinartem-dotcom.github.io/EBOOK/android-update/../Leaf.apk","https://kutlugildinartem-dotcom.github.io/EBOOK/android-update/%2e%2e/Leaf.apk","https://user@kutlugildinartem-dotcom.github.io/EBOOK/android-update/Leaf.apk","file:///Leaf.apk","https://kutlugildinartem-dotcom.github.io/EBOOK/android-update/Leaf.apk?redirect=evil"}) assert !UpdatePolicy.validApkUrl(bad) : bad;
        assert UpdatePolicy.validHash("a".repeat(64)); assert !UpdatePolicy.validHash("fake");
        assert UpdatePolicy.newer(2,3); assert !UpdatePolicy.newer(3,3); assert !UpdatePolicy.newer(3,2);
        System.out.println("Update origin/path/hash and upgrade-only policy passed.");
    }
}
