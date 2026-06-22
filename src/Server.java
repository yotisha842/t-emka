import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Server {

    private static final int PORT = 3000;
    private static final Path DATA_FILE = Path.of(System.getProperty("user.dir"), "data", "transactions.json");

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put(".html", "text/html; charset=utf-8");
        MIME.put(".css", "text/css");
        MIME.put(".js", "application/javascript");
    }

    public static void main(String[] args) throws IOException {
        TransactionStore store = new TransactionStore(DATA_FILE);

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/api/transactions", new TransactionsHandler(store));
        server.createContext("/", new StaticHandler());
        server.start();
        System.out.println("http://localhost:" + PORT);
    }

    // ---------- статика ----------

    static class StaticHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String requestPath = exchange.getRequestURI().getPath();
            if (requestPath.equals("/")) {
                requestPath = "/index.html";
            }

            Path filePath = Path.of(System.getProperty("user.dir"), requestPath);

            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                sendText(exchange, 404, "Not found", "text/plain");
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

    // ---------- REST API ----------

    static class TransactionsHandler implements HttpHandler {
        private final TransactionStore store;

        TransactionsHandler(TransactionStore store) {
            this.store = store;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod();
            String idPart = path.equals("/api/transactions") ? null : path.substring("/api/transactions/".length());

            try {
                if ("GET".equals(method) && idPart == null) {
                    sendJson(exchange, 200, Transaction.listToJson(store.getAll()));
                } else if ("POST".equals(method) && idPart == null) {
                    Transaction t = Transaction.fromJson(readBody(exchange));
                    Transaction created = store.add(t);
                    sendJson(exchange, 201, created.toJson());
                } else if ("PUT".equals(method) && idPart != null) {
                    long id = Long.parseLong(idPart);
                    Transaction t = Transaction.fromJson(readBody(exchange));
                    Transaction updated = store.update(id, t);
                    if (updated == null) sendText(exchange, 404, "Not found", "text/plain");
                    else sendJson(exchange, 200, updated.toJson());
                } else if ("DELETE".equals(method) && idPart != null) {
                    long id = Long.parseLong(idPart);
                    boolean removed = store.delete(id);
                    sendText(exchange, removed ? 204 : 404, "", "text/plain");
                } else {
                    sendText(exchange, 405, "Method not allowed", "text/plain");
                }
            } catch (Exception e) {
                sendText(exchange, 400, "Bad request: " + e.getMessage(), "text/plain");
            }
        }
    }

    // ---------- модель ----------

    static class Transaction {
        long id;
        String type;
        double amount;
        String category;
        String date;
        String comment;

        String toJson() {
            return "{\"id\":" + id +
                    ",\"type\":" + jsonStr(type) +
                    ",\"amount\":" + amount +
                    ",\"category\":" + jsonStr(category) +
                    ",\"date\":" + jsonStr(date) +
                    ",\"comment\":" + jsonStr(comment) + "}";
        }

        static String listToJson(List<Transaction> list) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(list.get(i).toJson());
            }
            return sb.append("]").toString();
        }

        static Transaction fromJson(String json) {
            Transaction t = new Transaction();
            t.id = parseLong(json, "id", System.currentTimeMillis());
            t.type = parseString(json, "type");
            t.amount = parseDouble(json, "amount");
            t.category = parseString(json, "category");
            t.date = parseString(json, "date");
            t.comment = parseString(json, "comment");
            return t;
        }

        private static String jsonStr(String s) {
            if (s == null) return "\"\"";
            return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        }

        private static String parseString(String json, String field) {
            Matcher m = Pattern.compile("\"" + field + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(json);
            if (!m.find()) return "";
            return m.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
        }

        private static double parseDouble(String json, String field) {
            Matcher m = Pattern.compile("\"" + field + "\"\\s*:\\s*(-?[0-9.]+)").matcher(json);
            return m.find() ? Double.parseDouble(m.group(1)) : 0;
        }

        private static long parseLong(String json, String field, long fallback) {
            Matcher m = Pattern.compile("\"" + field + "\"\\s*:\\s*(-?[0-9]+)").matcher(json);
            return m.find() ? Long.parseLong(m.group(1)) : fallback;
        }
    }

    // ---------- хранилище (JSON-файл) ----------

    static class TransactionStore {
        private final Path file;
        private final List<Transaction> transactions = new ArrayList<>();
        private final Object lock = new Object();

        TransactionStore(Path file) {
            this.file = file;
            load();
        }

        private void load() {
            try {
                if (Files.exists(file)) {
                    String json = Files.readString(file, StandardCharsets.UTF_8);
                    for (String item : splitJsonArray(json)) {
                        transactions.add(Transaction.fromJson(item));
                    }
                }
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        private void persist() {
            try {
                Files.createDirectories(file.getParent());
                Files.writeString(file, Transaction.listToJson(transactions), StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
        }

        List<Transaction> getAll() {
            synchronized (lock) {
                return new ArrayList<>(transactions);
            }
        }

        Transaction add(Transaction t) {
            synchronized (lock) {
                if (t.id == 0) t.id = System.currentTimeMillis();
                transactions.add(t);
                persist();
                return t;
            }
        }

        Transaction update(long id, Transaction t) {
            synchronized (lock) {
                for (int i = 0; i < transactions.size(); i++) {
                    if (transactions.get(i).id == id) {
                        t.id = id;
                        transactions.set(i, t);
                        persist();
                        return t;
                    }
                }
                return null;
            }
        }

        boolean delete(long id) {
            synchronized (lock) {
                boolean removed = transactions.removeIf(t -> t.id == id);
                if (removed) persist();
                return removed;
            }
        }

        private List<String> splitJsonArray(String json) {
            List<String> items = new ArrayList<>();
            json = json.trim();
            if (json.length() < 2) return items;
            json = json.substring(1, json.length() - 1).trim();
            if (json.isEmpty()) return items;

            int depth = 0, start = 0;
            for (int i = 0; i < json.length(); i++) {
                char c = json.charAt(i);
                if (c == '{') depth++;
                else if (c == '}') {
                    depth--;
                    if (depth == 0) {
                        items.add(json.substring(start, i + 1));
                        start = i + 1;
                    }
                }
            }
            return items;
        }
    }

    // ---------- утилиты ----------

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[1024];
            int n;
            while ((n = is.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString(StandardCharsets.UTF_8);
        }
    }

    private static void sendJson(HttpExchange exchange, int status, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void sendText(HttpExchange exchange, int status, String text, String contentType) throws IOException {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
        if (bytes.length > 0) {
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }
}
