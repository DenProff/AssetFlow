package com.itam.api;

import com.itam.persistence.*;
import com.itam.security.CurrentUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
// Endpoints /me возвращают данные, относящиеся к текущему авторизованному сотруднику
@RequestMapping("/me")
public class MeController {
    private final CurrentUserService currentUserService;
    private final EmployeeRepository employeeRepository;
    private final AssetMovementActRepository assetMovementActRepository;
    private final AssetRepository assetRepository;
    private final SoftwareInstallationRepository softwareInstallationRepository;
    private final SoftwareRepository softwareRepository;
    private final TicketRepository ticketRepository;

    public MeController(
            CurrentUserService currentUserService,
            EmployeeRepository employeeRepository,
            AssetMovementActRepository assetMovementActRepository,
            AssetRepository assetRepository,
            SoftwareInstallationRepository softwareInstallationRepository,
            SoftwareRepository softwareRepository,
            TicketRepository ticketRepository
    ) {
        this.currentUserService = currentUserService;
        this.employeeRepository = employeeRepository;
        this.assetMovementActRepository = assetMovementActRepository;
        this.assetRepository = assetRepository;
        this.softwareInstallationRepository = softwareInstallationRepository;
        this.softwareRepository = softwareRepository;
        this.ticketRepository = ticketRepository;
    }

    @GetMapping
    public ResponseEntity<?> me() {
        // employeeNo берётся из JWT, который JwtAuthFilter уже положил в SecurityContext
        String employeeNo = currentUserService.employeeNoOrNull();
        if (employeeNo == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthenticated"));
        }
        EmployeeEntity employee = employeeRepository.findById(employeeNo).orElse(null);
        if (employee == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unknown user"));
        }
        return ResponseEntity.ok(Map.of(
                "employeeNo", employee.getEmployeeNo(),
                "fullName", employee.getFullName(),
                "position", employee.getPosition(),
                "department", employee.getDepartment(),
                "role", currentUserService.roleOrNull()
        ));
    }

    @GetMapping("/assets")
    public ResponseEntity<?> myAssets() {
        String employeeNo = currentUserService.employeeNoOrNull();
        if (employeeNo == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthenticated"));
        }
        // Актив считается выданным сотруднику, если у акта выдачи ещё нет даты возврата
        List<String> inventoryNos = assetMovementActRepository
                .findOpenIssuesByEmployeeNo(employeeNo)
                .stream()
                .map(AssetMovementActEntity::getAssetInventoryNo)
                .collect(Collectors.toList());

        List<AssetEntity> assets = assetRepository.findAllById(inventoryNos);
        return ResponseEntity.ok(assets);
    }

    private static String computeLicenseStatus(java.time.LocalDate licenseEnd) {
        if (licenseEnd == null) return "Активна";
        java.time.LocalDate today = java.time.LocalDate.now();
        if (licenseEnd.isBefore(today)) return "Истекла";
        if (licenseEnd.isBefore(today.plusDays(30))) return "Истекает";
        return "Активна";
    }

    @GetMapping("/software")
    public ResponseEntity<?> mySoftware() {
        String employeeNo = currentUserService.employeeNoOrNull();
        if (employeeNo == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthenticated"));
        }
        // ПО пользователя определяется через активы, которые сейчас числятся за сотрудником
        List<String> inventoryNos = assetMovementActRepository
                .findOpenIssuesByEmployeeNo(employeeNo)
                .stream()
                .map(AssetMovementActEntity::getAssetInventoryNo)
                .collect(Collectors.toList());

        if (inventoryNos.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<SoftwareInstallationEntity> installations = inventoryNos.stream()
                .flatMap(inv -> softwareInstallationRepository.findByAssetInventoryNo(inv).stream())
                .collect(Collectors.toList());

        Map<Long, SoftwareEntity> swById = softwareRepository.findAllById(
                installations.stream().map(SoftwareInstallationEntity::getSoftwareId).distinct().collect(Collectors.toList())
        ).stream().collect(Collectors.toMap(SoftwareEntity::getId, sw -> sw));

        List<Map<String, Object>> result = installations.stream().map(inst -> {
            SoftwareEntity sw = swById.get(inst.getSoftwareId());
            if (sw == null) return null;
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("installationId", inst.getId());
            row.put("assetInventoryNo", inst.getAssetInventoryNo());
            row.put("installedAt", inst.getInstalledAt());
            row.put("softwareId", sw.getId());
            row.put("name", sw.getName());
            row.put("version", sw.getVersion());
            row.put("licenseEnd", sw.getLicenseEnd());
            row.put("licenseStatus", computeLicenseStatus(sw.getLicenseEnd()));
            return row;
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/tickets")
    public ResponseEntity<?> myTickets() {
        String employeeNo = currentUserService.employeeNoOrNull();
        if (employeeNo == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthenticated"));
        }
        // Профиль всегда показывает личную историю заявок независимо от роли пользователя
        return ResponseEntity.ok(ticketRepository.search(employeeNo, null, null));
    }
}
