package com.itam.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class AssetImportService {

    private static final List<String> EXPECTED_HEADER = List.of(
            "typeId", "manufacturer", "model", "serialNumber", "purchaseDate", "cost", "vendorName"
    );

    private final AssetService assetService;
    private final AuditService auditService;

    public AssetImportService(AssetService assetService, AuditService auditService) {
        this.assetService = assetService;
        this.auditService = auditService;
    }

    public ImportResult importCsv(MultipartFile file, String actorEmployeeNo) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV file is required");
        }

        int created = 0;
        List<RowError> errors = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                throw new IllegalArgumentException("CSV file is empty");
            }
            List<String> header = parseLine(removeBom(headerLine));
            if (!EXPECTED_HEADER.equals(header)) {
                throw new IllegalArgumentException("Неверный заголовок CSV. Ожидается: " + String.join(",", EXPECTED_HEADER));
            }

            String line;
            int rowNo = 1;
            while ((line = reader.readLine()) != null) {
                rowNo++;
                if (line.isBlank()) continue;
                try {
                    AssetService.CreateAssetCommand cmd = toCommand(parseLine(line));
                    assetService.createAsset(cmd, actorEmployeeNo);
                    created++;
                } catch (Exception ex) {
                    errors.add(new RowError(rowNo, ex.getMessage()));
                }
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Не удалось прочитать CSV-файл", ex);
        }

        auditService.log(actorEmployeeNo, "ASSET_IMPORT_CSV", "created=" + created + "; failed=" + errors.size());
        return new ImportResult(created, errors.size(), errors);
    }

    private AssetService.CreateAssetCommand toCommand(List<String> cols) {
        if (cols.size() != EXPECTED_HEADER.size()) {
            throw new IllegalArgumentException("Ожидалось " + EXPECTED_HEADER.size() + " колонок, получено " + cols.size());
        }
        Long typeId = parseLong(required(cols.get(0), "typeId"), "typeId");
        String manufacturer = required(cols.get(1), "manufacturer");
        String model = required(cols.get(2), "model");
        String serialNumber = required(cols.get(3), "serialNumber");
        LocalDate purchaseDate = parseDate(required(cols.get(4), "purchaseDate"));
        BigDecimal cost = parseDecimal(required(cols.get(5), "cost"));
        String vendorName = blankToNull(cols.get(6));
        return new AssetService.CreateAssetCommand(typeId, manufacturer, model, serialNumber, purchaseDate, cost, vendorName);
    }

    private static List<String> parseLine(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch == ',' && !inQuotes) {
                result.add(cell.toString().trim());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        if (inQuotes) {
            throw new IllegalArgumentException("Некорректные кавычки в CSV-строке");
        }
        result.add(cell.toString().trim());
        return result;
    }

    private static String removeBom(String s) {
        return s != null && s.startsWith("\uFEFF") ? s.substring(1) : s;
    }

    private static String required(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Поле " + field + " обязательно");
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static Long parseLong(String value, String field) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Поле " + field + " должно быть числом");
        }
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Дата покупки должна быть в формате YYYY-MM-DD");
        }
    }

    private static BigDecimal parseDecimal(String value) {
        try {
            return new BigDecimal(value.replace(',', '.'));
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("Стоимость должна быть числом");
        }
    }

    public record ImportResult(int createdCount, int failedCount, List<RowError> errors) {}
    public record RowError(int rowNo, String message) {}
}
