package com.itam.service;

import com.itam.persistence.*;
import org.apache.poi.ss.usermodel.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@Service
// Сервис заполняет Excel-шаблоны унифицированных форм ОС-1, ОС-2 и ОС-4
public class ActTemplateService {

    private static final DateTimeFormatter RU_DATE = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private static final String[] MONTHS_GENITIVE = {
        "января", "февраля", "марта", "апреля", "мая", "июня",
        "июля", "августа", "сентября", "октября", "ноября", "декабря"
    };

    private final AssetMovementActRepository movementActRepo;
    private final AssetWriteOffActRepository writeOffActRepo;
    private final AssetRepository assetRepo;
    private final AssetTypeRepository assetTypeRepo;
    private final EmployeeRepository employeeRepo;
    private final RoleRepository roleRepo;

    public ActTemplateService(
            AssetMovementActRepository movementActRepo,
            AssetWriteOffActRepository writeOffActRepo,
            AssetRepository assetRepo,
            AssetTypeRepository assetTypeRepo,
            EmployeeRepository employeeRepo,
            RoleRepository roleRepo
    ) {
        this.movementActRepo = movementActRepo;
        this.writeOffActRepo = writeOffActRepo;
        this.assetRepo = assetRepo;
        this.assetTypeRepo = assetTypeRepo;
        this.employeeRepo = employeeRepo;
        this.roleRepo = roleRepo;
    }

    // ─────────────── ОС-1: приём от поставщика (по данным актива) ─────────────

    public byte[] fillOs1FromAsset(String inventoryNo) {
        AssetEntity asset = assetRepo.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));
        AssetTypeEntity assetType = assetTypeRepo.findById(asset.getTypeId()).orElse(null);
        LocalDate d = asset.getPurchaseDate();

        try (InputStream is = loadTemplate("os1");
             Workbook wb = WorkbookFactory.create(is)) {

            Sheet sheet = wb.getSheetAt(0);

            // ── Сотрудники: загружаем заранее — нужны для УТВЕРЖДАЮ и комиссии
            Long mgrRoleId  = roleRepo.findByName("IT_MANAGER").map(r -> r.getId()).orElse(-1L);
            Long specRoleId = roleRepo.findByName("IT_SPECIALIST").map(r -> r.getId()).orElse(-1L);
            Long empRoleId  = roleRepo.findByName("EMPLOYEE").map(r -> r.getId()).orElse(-1L);
            java.util.List<EmployeeEntity> managers    = employeeRepo.findByRoleIdOrderByEmployeeNo(mgrRoleId);
            java.util.List<EmployeeEntity> specialists = employeeRepo.findByRoleIdOrderByEmployeeNo(specRoleId);
            java.util.List<EmployeeEntity> employees   = employeeRepo.findByRoleIdOrderByEmployeeNo(empRoleId);
            EmployeeEntity chairman = managers.isEmpty()    ? null : managers.get(0);
            EmployeeEntity member1  = specialists.isEmpty() ? null : specialists.get(0);
            EmployeeEntity member2  = employees.isEmpty()   ? null : employees.get(0);
            EmployeeEntity recipient = member1;

            // ── Код формы (EP11)
            set(sheet, 10, 145, "0306001");

            // ── Дата УТВЕРЖДАЮ: число (DA8), месяц (DH8), год (EE8)
            if (d != null) {
                set(sheet, 7, 104, String.format("%02d", d.getDayOfMonth()));
                set(sheet, 7, 111, MONTHS_GENITIVE[d.getMonthValue() - 1]);
                set(sheet, 7, 134, String.format("%02d", d.getYear() % 100));
            }

            // ── УТВЕРЖДАЮ: должность (CS6), фамилия (DS6), расшифровка (EK6)
            if (chairman != null) {
                set(sheet, 5, 96,  chairman.getPosition());
                set(sheet, 5, 122, chairman.getLastName());
                set(sheet, 5, 140, initials(chairman));
            }

            // ── Номер документа и дата в заголовке акта (BL35 и CE35)
            set(sheet, 34, 63, asset.getReceiptActNo());
            set(sheet, 34, 82, fmt(d));

            // ── Организация-получатель (Y12)
            set(sheet, 11, 24, "AssetFlow");

            // ── Организация-сдатчик = вендор (V20)
            set(sheet, 19, 21, asset.getVendorName());

            // ── Основание сделки (AF28)
            set(sheet, 27, 31, "Договор купли-продажи");

            // ── Даты документов (EP29, EP31)
            set(sheet, 28, 145, fmt(d));
            set(sheet, 30, 145, fmt(d));

            // ── Код единицы измерения (EP33)
            set(sheet, 32, 145, "01");

            // ── Код ОКОФ и амортизационная группа (EP34, EP35)
            if (assetType != null) {
                set(sheet, 33, 145, assetType.getOkofCode());
                if (assetType.getAmortizationGroupNo() != null) {
                    set(sheet, 34, 145, String.valueOf(assetType.getAmortizationGroupNo()));
                }
            }

            // ── Инвентарный (EP36) и заводской (EP37) номера
            set(sheet, 35, 145, asset.getInventoryNo());
            set(sheet, 36, 145, asset.getSerialNumber());

            // ── Наименование объекта ОС (Z40)
            set(sheet, 39, 25, (assetType != null ? assetType.getName() + " " : "") + asset.getManufacturer() + " " + asset.getModel());

            // ── Организация-изготовитель (AA45)
            set(sheet, 44, 26, asset.getManufacturer());

            // ── Стоимость (DD60), срок в месяцах (DT60), метод (ЕI60), доля (EX60)
            set(sheet, 59, 107, asset.getCost().toPlainString());
            if (assetType != null) {
                int months = assetType.getDefaultUsefulLifeYears() * 12;
                set(sheet, 59, 123, months + " мес");
                set(sheet, 59, 138, "линейный");
                if (months > 0) {
                    BigDecimal share = BigDecimal.valueOf(100)
                            .divide(BigDecimal.valueOf(months), 4, RoundingMode.HALF_UP);
                    set(sheet, 59, 153, share.stripTrailingZeros().toPlainString());
                }
            }

            // ── Полное наименование (A67) и количество (BG67)
            set(sheet, 66, 0, (assetType != null ? assetType.getName() + " " : "") + asset.getManufacturer() + " " + asset.getModel());
            set(sheet, 66, 58, "1");

            // ── Дата подписания: число (AF83), месяц (AL83), год (BK83)
            if (d != null) {
                set(sheet, 82, 31, String.format("%02d", d.getDayOfMonth()));
                set(sheet, 82, 37, MONTHS_GENITIVE[d.getMonthValue() - 1]);
                set(sheet, 82, 62, String.format("%02d", d.getYear() % 100));
            }

            // ── Техническое состояние (W90)
            set(sheet, 89, 22, "Рабочее состояние, годен к эксплуатации");

            // ── Комиссия: председатель + члены
            fillEmployee(sheet, 92, chairman, 28, 59, 81);
            fillEmployee(sheet, 94, member1,  28, 59, 81);
            fillEmployee(sheet, 96, member2,  28, 59, 81);
            fillEmployee(sheet, 102, recipient, 92, 117, 137);

            // ── Жирные ячейки BC84 и CP85 (содержимое уже есть в шаблоне)
            makeBold(wb, sheet, 83, 54);
            makeBold(wb, sheet, 84, 93);

            // ── Дата подписи руководителя (CS106=день, CM106=месяц, DN106=год)
            if (d != null) {
                set(sheet, 105, 96,  String.format("%02d", d.getDayOfMonth()));
                set(sheet, 105, 90,  MONTHS_GENITIVE[d.getMonthValue() - 1]);
                set(sheet, 105, 117, String.format("%02d", d.getYear() % 100));
            }

            // ── Порядковый номер документа бухгалтера (EF120) и дата (ES120)
            int docNo = 1;
            if (asset.getReceiptActNo() != null) {
                try {
                    String[] parts = asset.getReceiptActNo().split("-");
                    docNo = Integer.parseInt(parts[parts.length - 1]);
                } catch (NumberFormatException ignored) {}
            }
            set(sheet, 119, 135, String.valueOf(docNo));
            set(sheet, 119, 148, fmt(d));

            return toBytes(wb);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to fill ОС-1 template: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────── ОС-2: выдача сотруднику ────────────────────────

    public byte[] fillOs2(String actNo) {
        AssetMovementActEntity act = movementActRepo.findById(actNo)
                .orElseThrow(() -> new IllegalArgumentException("act not found: " + actNo));
        return fillOs2Document(act);
    }

    private byte[] fillOs2Document(AssetMovementActEntity act) {
        AssetEntity asset = assetRepo.findById(act.getAssetInventoryNo())
                .orElseThrow(() -> new IllegalArgumentException("asset not found"));
        AssetTypeEntity assetType = assetTypeRepo.findById(asset.getTypeId()).orElse(null);
        LocalDate d = act.getMovementDate();
        String documentNo = act.getActNo();

        EmployeeEntity actor = act.getActorEmployeeNo() != null
                ? employeeRepo.findById(act.getActorEmployeeNo()).orElse(null)
                : null;
        EmployeeEntity employee = employeeRepo.findById(act.getEmployeeNo()).orElse(null);
        EmployeeEntity sender = "RETURN".equals(act.getMovementType()) ? employee : actor;
        EmployeeEntity receiver = "RETURN".equals(act.getMovementType()) ? actor : employee;

        try (InputStream is = loadTemplate("os2");
             Workbook wb = WorkbookFactory.create(is)) {

            Sheet sheet = wb.getSheetAt(0);

            // Код формы (EW6)
            set(sheet, 5, 152, "0306032");

            // Организация (A7)
            set(sheet, 6, 0, "AssetFlow");

            // Подразделение сдатчика (K9)
            if (sender != null) {
                set(sheet, 8, 10, sender.getDepartment());
            }

            // Подразделение получателя (N11)
            if (receiver != null) {
                set(sheet, 10, 13, receiver.getDepartment());
            }

            // Номер документа (CQ16) и дата составления (DG16)
            int docNo = 1;
            if (documentNo != null) {
                try {
                    String[] parts = documentNo.split("-");
                    docNo = Integer.parseInt(parts[parts.length - 1]);
                } catch (NumberFormatException ignored) {}
            }
            set(sheet, 15, 94, String.valueOf(docNo));  // CQ16
            set(sheet, 15, 110, fmt(d));                // DG16

            // Строка таблицы (row 22)
            String fullName = (assetType != null ? assetType.getName() + " " : "")
                    + asset.getManufacturer() + " " + asset.getModel();
            set(sheet, 21, 0,   "1");                              // A22  — порядковый номер
            set(sheet, 21, 10,  fullName);                         // K22  — наименование
            set(sheet, 21, 59,  fmt(asset.getPurchaseDate()));     // BH22 — дата покупки
            set(sheet, 21, 80,  asset.getInventoryNo());           // CC22 — инв. номер
            set(sheet, 21, 101, "1");                              // CX22 — количество
            set(sheet, 21, 117, asset.getCost().toPlainString());  // DN22 — стоимость
            set(sheet, 21, 140, asset.getCost().toPlainString());  // EK22 — стоимость

            // Итоговая стоимость (EK56)
            set(sheet, 55, 140, asset.getCost().toPlainString());

            // Техническое состояние (CI58)
            set(sheet, 57, 86, "Оборудование находится в рабочем состоянии");

            // Сдатчик (строка 68)
            if (sender != null) {
                set(sheet, 67, 11,  sender.getPosition());    // L68
                set(sheet, 67, 49,  sender.getLastName());        // AX68
                set(sheet, 67, 72,  initials(sender));        // BU68
                set(sheet, 67, 109, sender.getEmployeeNo());  // DF68
            }
            if (d != null) {
                set(sheet, 67, 133, String.format("%02d", d.getDayOfMonth()));         // ED68
                set(sheet, 67, 140, MONTHS_GENITIVE[d.getMonthValue() - 1]);           // EK68
                set(sheet, 67, 159, String.format("%02d", d.getYear() % 100));         // FD68
            }

            // Получатель (строка 72)
            if (receiver != null) {
                set(sheet, 71, 11,  receiver.getPosition());    // L72
                set(sheet, 71, 49,  receiver.getLastName());    // AX72
                set(sheet, 71, 72,  initials(receiver));        // BU72
                set(sheet, 71, 109, receiver.getEmployeeNo());  // DF72
            }
            if (d != null) {
                set(sheet, 71, 133, String.format("%02d", d.getDayOfMonth()));         // ED72
                set(sheet, 71, 140, MONTHS_GENITIVE[d.getMonthValue() - 1]);           // EK72
                set(sheet, 71, 159, String.format("%02d", d.getYear() % 100));         // FD72
            }

            return toBytes(wb);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to fill ОС-2 template: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────── ОС-4 ────────────────────────────────────

    public byte[] fillOs4(String actNo) {
        AssetWriteOffActEntity act = writeOffActRepo.findById(actNo)
                .orElseThrow(() -> new IllegalArgumentException("act not found: " + actNo));
        AssetEntity asset = assetRepo.findById(act.getAssetInventoryNo())
                .orElseThrow(() -> new IllegalArgumentException("asset not found"));
        AssetTypeEntity assetType = assetTypeRepo.findById(asset.getTypeId()).orElse(null);
        LocalDate d = act.getWriteOffDate();

        Long mgrRoleId  = roleRepo.findByName("IT_MANAGER").map(r -> r.getId()).orElse(-1L);
        Long specRoleId = roleRepo.findByName("IT_SPECIALIST").map(r -> r.getId()).orElse(-1L);
        Long empRoleId  = roleRepo.findByName("EMPLOYEE").map(r -> r.getId()).orElse(-1L);
        java.util.List<EmployeeEntity> managers    = employeeRepo.findByRoleIdOrderByEmployeeNo(mgrRoleId);
        java.util.List<EmployeeEntity> specialists = employeeRepo.findByRoleIdOrderByEmployeeNo(specRoleId);
        java.util.List<EmployeeEntity> employees   = employeeRepo.findByRoleIdOrderByEmployeeNo(empRoleId);
        EmployeeEntity chairman = managers.isEmpty()    ? null : managers.get(0);
        EmployeeEntity member1  = specialists.isEmpty() ? null : specialists.get(0);
        EmployeeEntity member2  = employees.isEmpty()   ? null : employees.get(0);

        try (InputStream is = loadTemplate("os4");
             Workbook wb = WorkbookFactory.create(is)) {

            Sheet sheet = wb.getSheetAt(0);

            // Код формы по ОКУД (EW6)
            set(sheet, 5, 152, "0306003");

            // Организация (A7) и подразделение (A9)
            set(sheet, 6, 0, "AssetFlow");
            if (member1 != null) {
                set(sheet, 8, 0, member1.getDepartment());
            }

            // Основание: вид документа (AG12), локальный номер (EW12)
            set(sheet, 11, 32, "приказ");
            int docNo = 1;
            if (act.getActNo() != null) {
                try {
                    String[] parts = act.getActNo().split("-");
                    docNo = Integer.parseInt(parts[parts.length - 1]);
                } catch (NumberFormatException ignored) {}
            }
            set(sheet, 11, 152, String.valueOf(docNo));  // EW12

            // Даты
            set(sheet, 9,  152, fmt(d));  // EW10 — дата снятия с бухгалтерского учёта
            set(sheet, 12, 152, fmt(d));  // EW13 — дата акта

            // Материально ответственное лицо (AG15 = инициалы, EW15 = табельный номер)
            if (member1 != null) {
                set(sheet, 14, 32,  initials(member1));        // AG15
                set(sheet, 14, 152, member1.getEmployeeNo());  // EW15
            }

            // Руководитель (DB19 = должность, DW19 = подпись, EP19 = расшифровка)
            if (chairman != null) {
                set(sheet, 18, 105, chairman.getPosition());  // DB19
                set(sheet, 18, 145, initials(chairman));      // EP19
            }

            // Номер акта (BS23) и дата составления (CL23)
            set(sheet, 22, 70, act.getActNo());  // BS23
            set(sheet, 22, 89, fmt(d));          // CL23

            // День / месяц / год (EB23, EI23, FC23)
            if (d != null) {
                set(sheet, 22, 131, String.format("%02d", d.getDayOfMonth()));      // EB23
                set(sheet, 22, 138, MONTHS_GENITIVE[d.getMonthValue() - 1]);        // EI23
                set(sheet, 22, 158, String.format("%02d", d.getYear() % 100));      // FC23
            }

            // Причина списания (S27)
            set(sheet, 26, 18, act.getReason());

            // Строка таблицы (row 33)
            String fullName = (assetType != null ? assetType.getName() + " " : "")
                    + asset.getManufacturer() + " " + asset.getModel();
            set(sheet, 32, 0,   fullName);                          // A33
            set(sheet, 32, 33,  asset.getInventoryNo());            // AH33
            set(sheet, 32, 50,  asset.getSerialNumber());           // AY33
            set(sheet, 32, 68,  fmt(asset.getPurchaseDate()));      // BQ33 — дата производства
            set(sheet, 32, 84,  fmt(asset.getPurchaseDate()));      // CG33 — дата принятия к учёту
            set(sheet, 32, 112, asset.getCost().toPlainString());   // DI33 — первонач. стоимость

            // Фактический срок эксплуатации (CW33)
            if (asset.getPurchaseDate() != null && d != null) {
                long months = java.time.temporal.ChronoUnit.MONTHS.between(asset.getPurchaseDate(), d);
                long years = months / 12;
                long rem   = months % 12;
                set(sheet, 32, 100, (years > 0 ? years + " л. " : "") + rem + " мес.");  // CW33
            }

            // Амортизация (EI33) и остаточная стоимость (EW33)
            if (assetType != null && assetType.getDefaultUsefulLifeYears() > 0
                    && asset.getPurchaseDate() != null && d != null) {
                long totalMonths = assetType.getDefaultUsefulLifeYears() * 12L;
                long usedMonths  = java.time.temporal.ChronoUnit.MONTHS.between(asset.getPurchaseDate(), d);
                BigDecimal monthly = asset.getCost()
                        .divide(BigDecimal.valueOf(totalMonths), 2, RoundingMode.HALF_UP);
                BigDecimal accumulated = monthly.multiply(BigDecimal.valueOf(Math.min(usedMonths, totalMonths)));
                BigDecimal residual    = asset.getCost().subtract(accumulated).max(BigDecimal.ZERO);
                set(sheet, 32, 138, accumulated.toPlainString());  // EI33
                set(sheet, 32, 152, residual.toPlainString());     // EW33
            }

            // Повтор наименования (A43) и количество (AY43)
            set(sheet, 42, 0,  fullName);  // A43
            set(sheet, 42, 50, "1");       // AY43

            // Подлежит списанию по причине (CY47)
            set(sheet, 46, 102, "подлежит списанию по причине " + act.getReason());

            // Комиссия: председатель (51), члены (53, 55)
            fillEmployee(sheet, 50, chairman, 34, 72, 95);  // AI51, BU51, CR51
            fillEmployee(sheet, 52, member1,  34, 72, 95);  // AI53, BU53, CR53
            fillEmployee(sheet, 54, member2,  34, 72, 95);  // AI55, BU55, CR55

            return toBytes(wb);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to fill ОС-4 template: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────── Helpers ─────────────────────────────────────

    private InputStream loadTemplate(String form) throws Exception {
        for (String ext : new String[]{"xls", "xlsx"}) {
            // Шаблоны актов лежат в resources/acts и подставляются по имени формы
            ClassPathResource r = new ClassPathResource("acts/" + form + "_template." + ext);
            if (r.exists()) return r.getInputStream();
        }
        throw new IllegalStateException("Template not found for form: " + form +
                ". Put acts/" + form + "_template.xlsx in src/main/resources/acts/");
    }

    private static void set(Sheet sheet, int rowIdx, int colIdx, String value) {
        if (value == null) return;
        // Apache POI работает с индексами с нуля, поэтому координаты ячеек заданы как row/col
        Row row = sheet.getRow(rowIdx);
        if (row == null) row = sheet.createRow(rowIdx);
        Cell cell = row.getCell(colIdx);
        if (cell == null) cell = row.createCell(colIdx);
        cell.setCellValue(value);
    }

    private static String fmt(LocalDate date) {
        return date == null ? "" : date.format(RU_DATE);
    }

    private static void fillEmployee(Sheet sheet, int row,
                                      EmployeeEntity e,
                                      int posCol, int signCol, int decCol) {
        if (e == null) return;
        set(sheet, row, posCol, e.getPosition());
        set(sheet, row, signCol, e.getLastName());
        set(sheet, row, decCol, initials(e));
    }

    private static String initials(EmployeeEntity e) {
        if (e == null) return "";
        StringBuilder sb = new StringBuilder(e.getLastName());
        if (e.getFirstName() != null && !e.getFirstName().isBlank()) {
            sb.append(" ").append(e.getFirstName().charAt(0)).append(".");
        }
        if (e.getPatronymic() != null && !e.getPatronymic().isBlank()) {
            sb.append(e.getPatronymic().charAt(0)).append(".");
        }
        return sb.toString();
    }

    private static void makeBold(Workbook wb, Sheet sheet, int rowIdx, int colIdx) {
        Row row = sheet.getRow(rowIdx);
        if (row == null) return;
        Cell cell = row.getCell(colIdx);
        if (cell == null) return;
        CellStyle newStyle = wb.createCellStyle();
        newStyle.cloneStyleFrom(cell.getCellStyle());
        Font font = wb.createFont();
        font.setBold(true);
        newStyle.setFont(font);
        cell.setCellStyle(newStyle);
    }

    private static byte[] toBytes(Workbook wb) throws Exception {
        // Настройка печати помогает LibreOffice корректно конвертировать акт в PDF
        for (int i = 0; i < wb.getNumberOfSheets(); i++) {
            Sheet s = wb.getSheetAt(i);
            s.setFitToPage(true);
            s.setAutobreaks(true);
            PrintSetup ps = s.getPrintSetup();
            ps.setFitWidth((short) 1);
            ps.setFitHeight((short) 0);
            ps.setPaperSize((short) 9); // A4
            ps.setLandscape(true);
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
