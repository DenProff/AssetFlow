package com.itam.api;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellReference;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.util.*;

@RestController
@RequestMapping("/dev")
@Profile("!prod")
public class DevTemplateScannerController {

    record CellInfo(String ref, int sheet, String sheetName, int row, int col, String type, String value) {}

    @GetMapping("/scan-template/{form}")
    @PreAuthorize("hasRole('IT_MANAGER')")
    public Map<String, Object> scanTemplate(@PathVariable String form) throws Exception {
        String resourcePath = "acts/" + form + "_template.xlsx";
        ClassPathResource resource = new ClassPathResource(resourcePath);
        if (!resource.exists()) {
            resourcePath = "acts/" + form + "_template.xls";
            resource = new ClassPathResource(resourcePath);
            if (!resource.exists()) {
                throw new IllegalArgumentException("Template not found: acts/" + form + "_template.xlsx (or .xls). " +
                        "Put the file in src/main/resources/acts/");
            }
        }

        List<CellInfo> cells = new ArrayList<>();
        try (InputStream is = resource.getInputStream();
             Workbook wb = WorkbookFactory.create(is)) {

            for (int si = 0; si < wb.getNumberOfSheets(); si++) {
                Sheet sheet = wb.getSheetAt(si);
                String sheetName = sheet.getSheetName();

                for (Row row : sheet) {
                    for (Cell cell : row) {
                        String value = getCellValue(cell);
                        if (value != null && !value.isBlank()) {
                            String ref = new CellReference(cell.getRowIndex(), cell.getColumnIndex()).formatAsString();
                            cells.add(new CellInfo(
                                    ref,
                                    si,
                                    sheetName,
                                    cell.getRowIndex(),
                                    cell.getColumnIndex(),
                                    cell.getCellType().name(),
                                    value
                            ));
                        }
                    }
                }
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("form", form);
        result.put("totalNonEmptyCells", cells.size());
        result.put("cells", cells);
        return result;
    }

    private static String getCellValue(Cell cell) {
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getLocalDateTimeCellValue().toLocalDate().toString();
                }
                double d = cell.getNumericCellValue();
                yield d == Math.floor(d) ? String.valueOf((long) d) : String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try { yield String.valueOf(cell.getNumericCellValue()); }
                catch (Exception e) { yield cell.getStringCellValue(); }
            }
            default -> null;
        };
    }
}
