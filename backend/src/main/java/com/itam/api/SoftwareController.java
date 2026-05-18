package com.itam.api;

import com.itam.persistence.SoftwareEntity;
import com.itam.persistence.SoftwareInstallationEntity;
import com.itam.persistence.SoftwareRepository;
import com.itam.persistence.LicenseStatusRepository;
import com.itam.security.CurrentUserService;
import com.itam.service.SoftwareService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
// Контроллер ПО открывает API для реестра программ и установок на оборудование
@RequestMapping("/software")
public class SoftwareController {

    private final SoftwareRepository softwareRepository;
    private final SoftwareService softwareService;
    private final CurrentUserService currentUserService;
    private final LicenseStatusRepository licenseStatusRepository;

    public SoftwareController(SoftwareRepository softwareRepository, SoftwareService softwareService, CurrentUserService currentUserService, LicenseStatusRepository licenseStatusRepository) {
        this.softwareRepository = softwareRepository;
        this.softwareService = softwareService;
        this.currentUserService = currentUserService;
        this.licenseStatusRepository = licenseStatusRepository;
    }

    private static String computeStatus(LocalDate licenseEnd) {
        // Статус лицензии вычисляется по дате окончания при каждом чтении
        if (licenseEnd == null) return "Активна";
        LocalDate today = LocalDate.now();
        if (licenseEnd.isBefore(today)) return "Истекла";
        if (licenseEnd.isBefore(today.plusDays(30))) return "Истекает";
        return "Активна";
    }

    private Long statusIdFor(LocalDate licenseEnd) {
        return licenseStatusRepository.findByName(computeStatus(licenseEnd)).orElseThrow().getId();
    }

    private void applyComputedStatus(SoftwareEntity sw) {
        String status = computeStatus(sw.getLicenseEnd());
        sw.setLicenseStatus(status);
        sw.setLicenseStatusId(statusIdFor(sw.getLicenseEnd()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER')")
    public List<SoftwareEntity> list() {
        List<SoftwareEntity> all = softwareRepository.findAll();
        // Перед отдачей frontend обновляем отображаемый статус лицензии
        all.forEach(this::applyComputedStatus);
        return all;
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public SoftwareEntity get(@PathVariable Long id) {
        SoftwareEntity sw = softwareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("software not found: " + id));
        applyComputedStatus(sw);
        return sw;
    }

    public record CreateSoftwareRequest(
            @NotBlank String name,
            @NotBlank String version,
            @NotNull Long licenseTypeId,
            String licenseIdentifier,
            LocalDate licenseStart,
            LocalDate licenseEnd
    ) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public SoftwareEntity create(@RequestBody @Valid CreateSoftwareRequest request) {
        // Автор изменения берётся из JWT и используется для audit log
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return softwareService.create(new SoftwareService.CreateSoftwareCommand(
                request.name(),
                request.version(),
                request.licenseTypeId(),
                request.licenseIdentifier(),
                request.licenseStart(),
                request.licenseEnd()
        ), actor);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public SoftwareEntity update(@PathVariable Long id, @RequestBody @Valid CreateSoftwareRequest request) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        return softwareService.update(id, new SoftwareService.CreateSoftwareCommand(
                request.name(), request.version(), request.licenseTypeId(),
                request.licenseIdentifier(), request.licenseStart(), request.licenseEnd()
        ), actor);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public void delete(@PathVariable Long id) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) throw new IllegalStateException("Unauthenticated");
        softwareService.delete(id, actor);
    }

    @GetMapping("/{id}/installations")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public List<SoftwareInstallationEntity> installations(@PathVariable Long id) {
        // Возвращает все активы, на которых установлено выбранное ПО
        return softwareService.installationsForSoftware(id);
    }

    public record InstallRequest(@NotBlank String assetInventoryNo) {}

    @PostMapping("/{id}/install")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public SoftwareInstallationEntity install(@PathVariable Long id, @RequestBody @Valid InstallRequest request) {
        // Установка связывает ПО с конкретным инвентарным номером актива
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return softwareService.install(request.assetInventoryNo(), id, actor);
    }

    @DeleteMapping("/{id}/install/{assetInventoryNo}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public void uninstall(@PathVariable Long id, @PathVariable String assetInventoryNo) {
        String actor = currentUserService.employeeNoOrNull();
        if (actor == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        softwareService.uninstall(assetInventoryNo, id, actor);
    }

    @GetMapping("/asset/{inventoryNo}/installations")
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER')")
    public List<SoftwareInstallationEntity> installationsOnAsset(@PathVariable String inventoryNo) {
        // Используется карточкой актива и страницами, где нужно увидеть ПО на оборудовании
        return softwareService.installationsForAsset(inventoryNo);
    }
}
