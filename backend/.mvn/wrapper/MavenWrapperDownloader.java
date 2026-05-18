import java.io.*;
import java.net.*;
import java.nio.channels.*;
import java.util.Properties;

public class MavenWrapperDownloader {

    private static final String WRAPPER_VERSION = "3.3.2";
    private static final String DEFAULT_DOWNLOAD_URL = "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/" + WRAPPER_VERSION + "/maven-wrapper-" + WRAPPER_VERSION + ".jar";

    public static void main(String[] args) {
        System.out.println("- Downloader started");
        File baseDirectory = new File(args.length > 0 ? args[0] : "");
        System.out.println("- Using base directory: " + baseDirectory.getAbsolutePath());

        File mavenWrapperPropertyFile = new File(baseDirectory, ".mvn/wrapper/maven-wrapper.properties");
        String mavenWrapperJarPath = ".mvn/wrapper/maven-wrapper.jar";

        Properties mavenWrapperProperties = new Properties();
        FileInputStream mavenWrapperPropertyFileInputStream = null;
        try {
            mavenWrapperPropertyFileInputStream = new FileInputStream(mavenWrapperPropertyFile);
            mavenWrapperProperties.load(mavenWrapperPropertyFileInputStream);
        } catch (IOException e) {
            System.out.println("- ERROR loading " + mavenWrapperPropertyFile);
        } finally {
            try {
                if (mavenWrapperPropertyFileInputStream != null) {
                    mavenWrapperPropertyFileInputStream.close();
                }
            } catch (IOException e) {
                // Ignore
            }
        }

        String downloadUrl = mavenWrapperProperties.getProperty("wrapperUrl", DEFAULT_DOWNLOAD_URL);
        System.out.println("- Downloading from: " + downloadUrl);

        File mavenWrapperJarFile = new File(baseDirectory, mavenWrapperJarPath);
        if (!mavenWrapperJarFile.getParentFile().exists()) {
            if (!mavenWrapperJarFile.getParentFile().mkdirs()) {
                System.out.println("- ERROR creating directory " + mavenWrapperJarFile.getParentFile());
                System.exit(1);
            }
        }

        try {
            downloadFileFromURL(downloadUrl, mavenWrapperJarFile);
            System.out.println("Done");
        } catch (Throwable e) {
            System.out.println("- Error downloading");
            e.printStackTrace();
            System.exit(1);
        }
        System.exit(0);
    }

    private static void downloadFileFromURL(String urlString, File destination) throws Exception {
        URL website = URI.create(urlString).toURL();
        URLConnection connection = website.openConnection();
        connection.setReadTimeout(10000);
        ReadableByteChannel rbc;
        try {
            rbc = Channels.newChannel(connection.getInputStream());
        } catch (IOException e) {
            throw new IOException("Unable to open stream for URL " + urlString + ": " + e.getMessage(), e);
        }
        FileOutputStream fos = new FileOutputStream(destination);
        fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        fos.close();
        rbc.close();
    }
}
