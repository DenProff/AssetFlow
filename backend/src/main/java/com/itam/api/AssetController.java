package com.itam.api;

import com.itam.persistence.AssetEntity;
import com.itam.persistence.AssetRepository;
import com.itam.security.CurrentUserService;
import com.itam.service.ActTemplateService;
import com.itam.service.AssetImportService;
import com.itam.service.AssetService;
import com.itam.service.PdfService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
// Контроллер активов открывает API для учёта оборудования и скачивания акта ОС-1
@RequestMapping("/assets")
public class AssetController {

    private final AssetRepository assetRepository;
    private final AssetService assetService;
    private final AssetImportService assetImportService;
    private final ActTemplateService actTemplateService;
    private final PdfService pdfService;
    private final CurrentUserService currentUserService;

    public AssetController(AssetRepository assetRepository, AssetService assetService,
                           AssetImportService assetImportService,
                           ActTemplateService actTemplateService, PdfService pdfService,
                           CurrentUserService currentUserService) {
        this.assetRepository = assetRepository;
        this.assetService = assetService;
        this.assetImportService = assetImportService;
        this.actTemplateService = actTemplateService;
        this.pdfService = pdfService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public List<AssetEntity> list(@RequestParam(required = false) Long statusId, @RequestParam(required = false) Long typeId) {
        // Фильтры необязательные, поэтому null означает без ограничения по этому полю
        return assetRepository.search(statusId, typeId);
    }

    public record CreateAssetRequest(
            @NotNull Long typeId,
            @NotBlank String manufacturer,
            @NotBlank String model,
            @NotBlank String serialNumber,
            @NotNull LocalDate purchaseDate,
            @NotNull @PositiveOrZero BigDecimal cost,
            String vendorName
    ) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetEntity create(@RequestBody @Valid CreateAssetRequest request) {
        // Кто создал актив, определяется по JWT и записывается в аудит
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return assetService.createAsset(new AssetService.CreateAssetCommand(
                request.typeId(),
                request.manufacturer(),
                request.model(),
                request.serialNumber(),
                request.purchaseDate(),
                request.cost(),
                request.vendorName()
        ), actor);
    }

    public record UpdateAssetRequest(
            @NotNull Long typeId,
            @NotBlank String manufacturer,
            @NotBlank String model,
            @NotBlank String serialNumber,
            @NotNull LocalDate purchaseDate,
            @NotNull @PositiveOrZero BigDecimal cost,
            String vendorName
    ) {}

    @PutMapping("/{inventoryNo}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetEntity update(@PathVariable String inventoryNo, @RequestBody @Valid UpdateAssetRequest request) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        return assetService.updateAsset(inventoryNo, new AssetService.UpdateAssetCommand(
                request.typeId(), request.manufacturer(), request.model(),
                request.serialNumber(), request.purchaseDate(), request.cost(), request.vendorName()
        ), actor);
    }

    @DeleteMapping("/{inventoryNo}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public void delete(@PathVariable String inventoryNo) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        assetService.deleteAsset(inventoryNo, actor);
    }

    @PostMapping(value = "/import/csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetImportService.ImportResult importCsv(@RequestPart("file") MultipartFile file) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        // CSV-импорт использует тот же сервис создания активов, что и ручная форма
        return assetImportService.importCsv(file, actor);
    }

    @GetMapping("/import/template")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> importTemplate() {
        String csv = "\uFEFFtypeId,manufacturer,model,serialNumber,purchaseDate,cost,vendorName\n"
                + "1,Lenovo,ThinkPad E14,SN-IMPORT-001,2026-05-01,85000,ООО Поставщик\n";
        String filename = java.net.URLEncoder.encode("assets-import-template.csv", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    public record PatchStatusRequest(@NotBlank String statusName) {}

    @PatchMapping("/{inventoryNo}/status")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetEntity patchStatus(@PathVariable String inventoryNo, @RequestBody @Valid PatchStatusRequest request) {
        // Ручная смена статуса ограничена правилами AssetService
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        return assetService.changeStatus(inventoryNo, request.statusName(), actor);
    }

    @GetMapping("/{inventoryNo}/os1")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> os1Xls(@PathVariable String inventoryNo) {
        // XLS формируется из шаблона ОС-1 и отдаётся как файл для скачивания
        byte[] xls = actTemplateService.fillOs1FromAsset(inventoryNo);
        String filename = java.net.URLEncoder.encode(inventoryNo + "-ОС-1.xls", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .body(xls);
    }

    @GetMapping("/{inventoryNo}/os1/pdf")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> os1Pdf(@PathVariable String inventoryNo) {
        // PDF строится из Excel-шаблона, а fallback HTML нужен если конвертация Excel недоступна
        AssetEntity asset = assetRepository.findById(inventoryNo).orElseThrow();
        byte[] xls = actTemplateService.fillOs1FromAsset(inventoryNo);
        String fallback = "<html><head><meta charset='utf-8'><style>body{font-family:Arial,serif;font-size:12pt}</style></head><body>"
                + "<h2>Акт ОС-1 — Приём-передача объекта основных средств</h2>"
                + "<p><b>Номер акта:</b> " + esc(asset.getReceiptActNo()) + "</p>"
                + "<p><b>Инвентарный номер:</b> " + esc(asset.getInventoryNo()) + "</p>"
                + "<p><b>Наименование:</b> " + esc(asset.getManufacturer() + " " + asset.getModel()) + "</p>"
                + "<p><b>Серийный номер:</b> " + esc(asset.getSerialNumber()) + "</p>"
                + "<p><b>Поставщик:</b> " + esc(asset.getVendorName()) + "</p>"
                + "<p><b>Дата покупки:</b> " + asset.getPurchaseDate() + "</p>"
                + "<p><b>Стоимость, руб.:</b> " + asset.getCost().toPlainString() + "</p>"
                + "</body></html>";
        byte[] pdf = pdfService.excelToPdf(xls, "xls", fallback);
        String filename = java.net.URLEncoder.encode(inventoryNo + "-ОС-1.pdf", StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + filename)
                .body(pdf);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
