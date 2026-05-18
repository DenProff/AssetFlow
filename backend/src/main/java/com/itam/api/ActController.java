package com.itam.api;

import com.itam.persistence.AssetMovementActEntity;
import com.itam.persistence.AssetMovementActRepository;
import com.itam.persistence.AssetWriteOffActEntity;
import com.itam.persistence.AssetWriteOffActRepository;
import com.itam.security.CurrentUserService;
import com.itam.service.ActService;
import com.itam.service.ActTemplateService;
import com.itam.service.PdfService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
// Контроллер актов управляет выдачей ОС-2, возвратом и списанием ОС-4
@RequestMapping("/acts")
public class ActController {

    private final ActService actService;
    private final AssetMovementActRepository assetMovementActRepository;
    private final AssetWriteOffActRepository assetWriteOffActRepository;
    private final PdfService pdfService;
    private final ActTemplateService actTemplateService;
    private final CurrentUserService currentUserService;

    public ActController(
            ActService actService,
            AssetMovementActRepository assetMovementActRepository,
            AssetWriteOffActRepository assetWriteOffActRepository,
            PdfService pdfService,
            ActTemplateService actTemplateService,
            CurrentUserService currentUserService
    ) {
        this.actService = actService;
        this.assetMovementActRepository = assetMovementActRepository;
        this.assetWriteOffActRepository = assetWriteOffActRepository;
        this.pdfService = pdfService;
        this.actTemplateService = actTemplateService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/movement")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public List<AssetMovementActEntity> listMovement() {
        return assetMovementActRepository.findAll();
    }

    @GetMapping("/writeoff")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public List<AssetWriteOffActEntity> listWriteOff() {
        return assetWriteOffActRepository.findAll();
    }

    public record IssueRequest(
            @NotBlank String inventoryNo,
            @NotBlank String employeeNo,
            @NotNull LocalDate issueDate
    ) {}

    @PostMapping("/movement/issue")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetMovementActEntity issue(@RequestBody @Valid IssueRequest request) {
        // Кто оформил акт, определяется по JWT и передаётся в сервис для аудита
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return actService.issueAsset(request.inventoryNo(), request.employeeNo(), request.issueDate(), actor);
    }

    public record ReturnRequest(@NotNull LocalDate returnDate) {}

    @PostMapping("/movement/{actNo}/return")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetMovementActEntity returnAsset(@PathVariable String actNo, @RequestBody @Valid ReturnRequest request) {
        // Возврат закрывает открытый акт выдачи через заполнение returnDate
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return actService.returnAsset(actNo, request.returnDate(), actor);
    }

    public record WriteOffRequest(
            @NotBlank String inventoryNo,
            @NotBlank String reason,
            @NotNull LocalDate writeOffDate
    ) {}

    @PostMapping("/writeoff")
    @PreAuthorize("hasRole('IT_MANAGER')")
    public AssetWriteOffActEntity writeOff(@RequestBody @Valid WriteOffRequest request) {
        // Списание доступно только IT_MANAGER, потому что переводит актив в финальный статус
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return actService.writeOff(request.inventoryNo(), request.reason(), request.writeOffDate(), actor);
    }

    @GetMapping("/movement/{actNo}/pdf")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> movementPdf(@PathVariable String actNo) {
        // PDF ОС-2 строится из Excel-шаблона с HTML fallback
        AssetMovementActEntity act = assetMovementActRepository.findById(actNo).orElseThrow();
        byte[] xls = actTemplateService.fillOs2(actNo);
        String movementType = "RETURN".equals(act.getMovementType()) ? "Возврат" : "Выдача";
        String fallback = "<html><head><meta charset='utf-8'><style>body{font-family:Arial,serif;font-size:12pt}</style></head><body>"
                + "<h2>Накладная на внутреннее перемещение (ОС-2)</h2>"
                + "<p><b>Номер акта:</b> " + esc(act.getActNo()) + "</p>"
                + "<p><b>Тип перемещения:</b> " + movementType + "</p>"
                + "<p><b>Инвентарный номер:</b> " + esc(act.getAssetInventoryNo()) + "</p>"
                + "<p><b>Табельный номер:</b> " + esc(act.getEmployeeNo()) + "</p>"
                + "<p><b>Дата перемещения:</b> " + act.getMovementDate() + "</p>"
                + "</body></html>";
        byte[] pdf = pdfService.excelToPdf(xls, "xls", fallback);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionFilename(actNo + ".pdf"))
                .body(pdf);
    }

    @GetMapping("/writeoff/{actNo}/pdf")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> writeOffPdf(@PathVariable String actNo) {
        // PDF ОС-4 строится из Excel-шаблона с HTML fallback
        AssetWriteOffActEntity act = assetWriteOffActRepository.findById(actNo).orElseThrow();
        byte[] xls = actTemplateService.fillOs4(actNo);
        String fallback = "<html><head><meta charset='utf-8'><style>body{font-family:Arial,serif;font-size:12pt}</style></head><body>"
                + "<h2>Акт списания (ОС-4)</h2>"
                + "<p><b>Номер акта:</b> " + esc(act.getActNo()) + "</p>"
                + "<p><b>Инвентарный номер:</b> " + esc(act.getAssetInventoryNo()) + "</p>"
                + "<p><b>Причина:</b> " + esc(act.getReason()) + "</p>"
                + "<p><b>Дата списания:</b> " + act.getWriteOffDate() + "</p>"
                + "</body></html>";
        byte[] pdf = pdfService.excelToPdf(xls, "xls", fallback);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionFilename(actNo + ".pdf"))
                .body(pdf);
    }

    @GetMapping("/movement/{actNo}/xls")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> movementXls(@PathVariable String actNo) {
        // XLS ОС-2 отдаётся как файл для скачивания
        byte[] xls = actTemplateService.fillOs2(actNo);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionFilename(actNo + ".xls"))
                .body(xls);
    }

    @GetMapping("/writeoff/{actNo}/xls")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public ResponseEntity<byte[]> writeOffXls(@PathVariable String actNo) {
        // XLS ОС-4 отдаётся как файл для скачивания
        byte[] xls = actTemplateService.fillOs4(actNo);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.ms-excel"))
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDispositionFilename(actNo + ".xls"))
                .body(xls);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String contentDispositionFilename(String filename) {
        String encoded = java.net.URLEncoder.encode(filename, StandardCharsets.UTF_8);
        return "attachment; filename*=UTF-8''" + encoded;
    }
}
