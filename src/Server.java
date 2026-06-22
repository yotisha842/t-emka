import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public class Server {

    private static final int PORT = 3000;

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put(".html", "text/html; charset=utf-8");
        MIME.put(".css", "text/css");
        MIME.put(".js", "application/javascript");
    }

    public static void main(String[] args) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/", new StaticHandler());
        server.start();
        System.out.println("http://localhost:" + PORT);
    }

    static class StaticHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String requestPath = exchange.getRequestURI().getPath();
            if (requestPath.equals("/")) {
                requestPath = "/index.html";
            }

            Path filePath = Path.of(System.getProperty("user.dir"), requestPath);

            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                byte[] notFound = "Not found".getBytes();
                exchange.sendResponseHeaders(404, notFound.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(notFound);
                }
                return;
            }

            byte[] content = Files.readAllBytes(filePath);
            String ext = getExtension(requestPath);
            String contentType = MIME.getOrDefault(ext, "text/plain");

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, content.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(content);
            }
        }

        private String getExtension(String path) {
            int dotIndex = path.lastIndexOf('.');
            return dotIndex == -1 ? "" : path.substring(dotIndex);
        }
    }
}
