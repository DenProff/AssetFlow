package com.itam.service;

import com.itam.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class SoftwareService {

    private final SoftwareRepository softwareRepository;
    private final SoftwareInstallationRepository installationRepository;
    private final AssetRepository assetRepository;
    private final AssetStatusRepository assetStatusRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final AssetMovementActRepository assetMovementActRepository;
    private final LicenseStatusRepository licenseStatusRepository;

    public SoftwareService(
            SoftwareRepository softwareRepository,
            SoftwareInstallationRepository installationRepository,
            AssetRepository assetRepository,
            AssetStatusRepository assetStatusRepository,
            AuditService auditService,
            NotificationService notificationService,
            EmployeeRepository employeeRepository,
            RoleRepository roleRepository,
            AssetMovementActRepository assetMovementActRepository,
            LicenseStatusRepository licenseStatusRepository
    ) {
        this.softwareRepository = softwareRepository;
        this.installationRepository = installationRepository;
        this.assetRepository = assetRepository;
        this.assetStatusRepository = assetStatusRepository;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.assetMovementActRepository = assetMovementActRepository;
        this.licenseStatusRepository = licenseStatusRepository;
    }

    private String computeStatus(java.time.LocalDate licenseEnd) {
        if (licenseEnd == null) return "Активна";
        java.time.LocalDate today = java.time.LocalDate.now();
        if (licenseEnd.isBefore(today)) return "Истекла";
        if (licenseEnd.isBefore(today.plusDays(30))) return "Истекает";
        return "Активна";
    }

    private Long statusIdFor(java.time.LocalDate licenseEnd) {
        return licenseStatusRepository.findByName(computeStatus(licenseEnd)).orElseThrow().getId();
    }

    private AssetEntity requireUsableAsset(String assetInventoryNo) {
        AssetEntity asset = assetRepository.findById(assetInventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + assetInventoryNo));
        String statusName = assetStatusRepository.findById(asset.getStatusId())
                .map(AssetStatusEntity::getName).orElse("");
        if ("Списано".equals(statusName)) {
            throw new IllegalStateException("Нельзя установить ПО: оборудование списано");
        }
        return asset;
    }

    private boolean hasInstalledProduct(String assetInventoryNo, String softwareName) {
        return installationRepository.findByAssetInventoryNo(assetInventoryNo).stream()
                .anyMatch(inst -> softwareRepository.findById(inst.getSoftwareId())
                        .map(installed -> installed.getName().equals(softwareName))
                        .orElse(false));
    }

    @Transactional
    public SoftwareEntity create(CreateSoftwareCommand cmd, String actorEmployeeNo) {
        // Создание ПО добавляет запись в реестр и уведомляет IT-роли
        if (cmd.name() == null || cmd.name().isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (cmd.version() == null || cmd.version().isBlank()) {
            throw new IllegalArgumentException("version is required");
        }
        if (cmd.licenseTypeId() == null) {
            throw new IllegalArgumentException("licenseTypeId is required");
        }
        if (softwareRepository.existsByNameAndVersion(cmd.name(), cmd.version())) {
            throw new IllegalArgumentException("software with this name and version already exists");
        }

        SoftwareEntity sw = new SoftwareEntity();
        sw.setName(cmd.name());
        sw.setVersion(cmd.version());
        sw.setLicenseTypeId(cmd.licenseTypeId());
        sw.setLicenseIdentifier(cmd.licenseIdentifier());
        sw.setLicenseStart(cmd.licenseStart());
        sw.setLicenseEnd(cmd.licenseEnd());
        sw.setLicenseStatusId(statusIdFor(cmd.licenseEnd()));
        sw.setLicenseStatus(computeStatus(cmd.licenseEnd()));

        SoftwareEntity saved = softwareRepository.save(sw);
        auditService.log(actorEmployeeNo, "SOFTWARE_CREATED", "id=" + saved.getId() + "; name=" + saved.getName());

        String notifyBody = saved.getName() + " " + saved.getVersion()
                + (saved.getLicenseEnd() != null ? "; Действует до: " + saved.getLicenseEnd() : "; Бессрочная");
        for (String roleName : List.of("IT_SPECIALIST", "IT_MANAGER")) {
            Long roleId = roleRepository.findByName(roleName).map(RoleEntity::getId).orElse(-1L);
            for (EmployeeEntity emp : employeeRepository.findByRoleIdOrderByEmployeeNo(roleId)) {
                notificationService.notifyTicket(emp.getEmployeeNo(),
                        "Новое ПО добавлено", notifyBody, null, "SOFTWARE_CREATED");
            }
        }
        return saved;
    }

    @Transactional
    public SoftwareInstallationEntity install(String assetInventoryNo, Long softwareId, String actorEmployeeNo) {
        // Установка ПО создаёт связь между программой и конкретным активом
        if (assetInventoryNo == null || assetInventoryNo.isBlank()) {
            throw new IllegalArgumentException("assetInventoryNo is required");
        }
        if (softwareId == null) {
            throw new IllegalArgumentException("softwareId is required");
        }

        requireUsableAsset(assetInventoryNo);

        SoftwareEntity swToInstall = softwareRepository.findById(softwareId)
                .orElseThrow(() -> new IllegalArgumentException("software not found: " + softwareId));

        if (swToInstall.getLicenseEnd() != null && swToInstall.getLicenseEnd().isBefore(java.time.LocalDate.now())) {
            throw new IllegalStateException("Лицензия ПО истекла — установка невозможна");
        }

        // Одно и то же ПО нельзя установить на один актив дважды
        if (installationRepository.existsByAssetInventoryNoAndSoftwareId(assetInventoryNo, softwareId)) {
            throw new IllegalStateException("software is already installed on this asset");
        }
        if (hasInstalledProduct(assetInventoryNo, swToInstall.getName())) {
            throw new IllegalStateException("На оборудовании уже установлена другая версия этого ПО. Используйте обновление версии");
        }

        SoftwareInstallationEntity inst = new SoftwareInstallationEntity();
        inst.setAssetInventoryNo(assetInventoryNo);
        inst.setSoftwareId(softwareId);
        inst.setInstalledAt(LocalDateTime.now());
        inst.setInstalledVersion(swToInstall.getVersion());
        inst.setUpdatedAt(null);

        SoftwareInstallationEntity saved = installationRepository.save(inst);
        auditService.log(actorEmployeeNo, "SOFTWARE_INSTALLED", "softwareId=" + softwareId + "; asset=" + assetInventoryNo);
        SoftwareEntity sw = softwareRepository.findById(softwareId).orElse(null);
        // Если актив выдан сотруднику, он получает уведомление об установке ПО
        assetMovementActRepository.findOpenIssuesByAssetInventoryNo(assetInventoryNo).stream().findFirst().ifPresent(act -> {
            String swName = sw != null ? sw.getName() + " " + sw.getVersion() : "ПО #" + softwareId;
            notificationService.notifyTicket(act.getEmployeeNo(),
                    "На ваше устройство установлено ПО",
                    swName + "; Инв. №: " + assetInventoryNo, null, "SOFTWARE_INSTALLED");
        });
        return saved;
    }

    @Transactional
    public void uninstall(String assetInventoryNo, Long softwareId, String actorEmployeeNo) {
        // Удаление установки разрывает связь ПО с активом, но не удаляет само ПО
        if (assetInventoryNo == null || assetInventoryNo.isBlank()) {
            throw new IllegalArgumentException("assetInventoryNo is required");
        }
        if (softwareId == null) {
            throw new IllegalArgumentException("softwareId is required");
        }

        SoftwareInstallationEntity inst = installationRepository
                .findByAssetInventoryNoAndSoftwareId(assetInventoryNo, softwareId)
                .orElseThrow(() -> new IllegalArgumentException("installation not found"));

        installationRepository.delete(inst);
        auditService.log(actorEmployeeNo, "SOFTWARE_UNINSTALLED", "softwareId=" + softwareId + "; asset=" + assetInventoryNo);
    }

    public List<SoftwareInstallationEntity> installationsForAsset(String assetInventoryNo) {
        // Возвращает всё ПО, установленное на конкретный актив
        return installationRepository.findByAssetInventoryNo(assetInventoryNo);
    }

    @Transactional
    public SoftwareEntity update(Long id, CreateSoftwareCommand cmd, String actorEmployeeNo) {
        SoftwareEntity sw = softwareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("software not found: " + id));
        if (softwareRepository.existsByNameAndVersionAndIdNot(cmd.name(), cmd.version(), id)) {
            throw new IllegalArgumentException("software with this name and version already exists");
        }
        List<String> changes = new ArrayList<>();
        // В аудит записываются только реально изменённые поля карточки ПО
        if (!Objects.equals(sw.getName(), cmd.name()))                   changes.add("name: " + sw.getName() + "→" + cmd.name());
        if (!Objects.equals(sw.getVersion(), cmd.version()))             changes.add("version: " + sw.getVersion() + "→" + cmd.version());
        if (!Objects.equals(sw.getLicenseTypeId(), cmd.licenseTypeId())) changes.add("licenseType: " + sw.getLicenseTypeId() + "→" + cmd.licenseTypeId());
        if (!Objects.equals(sw.getLicenseIdentifier(), cmd.licenseIdentifier())) changes.add("key: " + sw.getLicenseIdentifier() + "→" + cmd.licenseIdentifier());
        if (!Objects.equals(sw.getLicenseStart(), cmd.licenseStart()))   changes.add("start: " + sw.getLicenseStart() + "→" + cmd.licenseStart());
        if (!Objects.equals(sw.getLicenseEnd(), cmd.licenseEnd()))       changes.add("end: " + sw.getLicenseEnd() + "→" + cmd.licenseEnd());
        if (changes.isEmpty()) return sw;
        sw.setName(cmd.name());
        sw.setVersion(cmd.version());
        sw.setLicenseTypeId(cmd.licenseTypeId());
        sw.setLicenseIdentifier(cmd.licenseIdentifier());
        sw.setLicenseStart(cmd.licenseStart());
        sw.setLicenseEnd(cmd.licenseEnd());
        sw.setLicenseStatusId(statusIdFor(cmd.licenseEnd()));
        sw.setLicenseStatus(computeStatus(cmd.licenseEnd()));
        SoftwareEntity saved = softwareRepository.save(sw);
        auditService.log(actorEmployeeNo, "SOFTWARE_UPDATED", "id=" + id + "; " + String.join("; ", changes));
        return saved;
    }

    @Transactional
    public void delete(Long id, String actorEmployeeNo) {
        SoftwareEntity sw = softwareRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("software not found: " + id));
        // Нельзя удалить ПО, пока оно установлено хотя бы на один актив
        if (!installationRepository.findBySoftwareId(id).isEmpty()) {
            throw new IllegalStateException("ПО установлено на оборудование — удаление невозможно");
        }
        softwareRepository.delete(sw);
        auditService.log(actorEmployeeNo, "SOFTWARE_DELETED", "id=" + id + "; name=" + sw.getName());
    }

    public List<SoftwareInstallationEntity> installationsForSoftware(Long softwareId) {
        // Возвращает все активы, на которых установлено выбранное ПО
        return installationRepository.findBySoftwareId(softwareId);
    }

    public record CreateSoftwareCommand(
            String name,
            String version,
            Long licenseTypeId,
            String licenseIdentifier,
            java.time.LocalDate licenseStart,
            java.time.LocalDate licenseEnd
    ) {}
}
