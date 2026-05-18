package com.itam.service;

import com.itam.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketStatusRepository ticketStatusRepository;
    private final SequenceService sequenceService;
    private final NotificationService notificationService;
    private final AuditService auditService;
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final AssetRepository assetRepository;
    private final AssetStatusRepository assetStatusRepository;
    private final AssetMovementActRepository assetMovementActRepository;
    private final SoftwareInstallationRepository softwareInstallationRepository;
    private final SoftwareRepository softwareRepository;

    public TicketService(
            TicketRepository ticketRepository,
            TicketStatusRepository ticketStatusRepository,
            SequenceService sequenceService,
            NotificationService notificationService,
            AuditService auditService,
            EmployeeRepository employeeRepository,
            RoleRepository roleRepository,
            AssetRepository assetRepository,
            AssetStatusRepository assetStatusRepository,
            AssetMovementActRepository assetMovementActRepository,
            SoftwareInstallationRepository softwareInstallationRepository,
            SoftwareRepository softwareRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.ticketStatusRepository = ticketStatusRepository;
        this.sequenceService = sequenceService;
        this.notificationService = notificationService;
        this.auditService = auditService;
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.assetRepository = assetRepository;
        this.assetStatusRepository = assetStatusRepository;
        this.assetMovementActRepository = assetMovementActRepository;
        this.softwareInstallationRepository = softwareInstallationRepository;
        this.softwareRepository = softwareRepository;
    }

    private AssetEntity requireUsableAsset(String assetInventoryNo) {
        AssetEntity asset = assetRepository.findById(assetInventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + assetInventoryNo));
        String statusName = assetStatusRepository.findById(asset.getStatusId())
                .map(AssetStatusEntity::getName).orElse("");
        if ("Списано".equals(statusName)) {
            throw new IllegalStateException("Нельзя создать заявку: оборудование списано");
        }
        return asset;
    }

    private SoftwareInstallationEntity findInstalledProduct(String assetInventoryNo, String softwareName) {
        return softwareInstallationRepository.findByAssetInventoryNo(assetInventoryNo).stream()
                .filter(inst -> softwareRepository.findById(inst.getSoftwareId())
                        .map(installed -> installed.getName().equals(softwareName))
                        .orElse(false))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ПО не установлено на данное оборудование — обновление невозможно"));
    }

    private void notifyAssetHolderSoftwareChanged(String assetInventoryNo, String title, String body, String ticketNo, String type) {
        assetMovementActRepository.findOpenIssuesByAssetInventoryNo(assetInventoryNo).stream().findFirst().ifPresent(act ->
                notificationService.notifyTicket(act.getEmployeeNo(), title, body, ticketNo, type));
    }

    @Transactional
    public TicketEntity create(CreateTicketCommand cmd) {
        // Все изменения внутри метода сохраняются одной транзакцией
        if (cmd == null || cmd.authorEmployeeNo() == null) {
            throw new IllegalArgumentException("authorEmployeeNo is required");
        }

        if (cmd.type() == null || cmd.type().isBlank()) {
            throw new IllegalArgumentException("type is required");
        }
        boolean requiresAsset = "Ремонт оборудования".equals(cmd.type())
                || "Установка ПО".equals(cmd.type())
                || "Обновление ПО".equals(cmd.type());
        if (requiresAsset && (cmd.assetInventoryNo() == null || cmd.assetInventoryNo().isBlank())) {
            throw new IllegalArgumentException("assetInventoryNo is required");
        }
        if (cmd.assetInventoryNo() != null && !cmd.assetInventoryNo().isBlank()) {
            requireUsableAsset(cmd.assetInventoryNo());
        }

        // Для заявок по ПО backend повторно проверяет, можно ли установить или обновить выбранное ПО
        if (cmd.softwareId() != null && cmd.assetInventoryNo() != null) {
            SoftwareEntity sw = softwareRepository.findById(cmd.softwareId())
                    .orElseThrow(() -> new IllegalArgumentException("software not found: " + cmd.softwareId()));
            if (sw.getLicenseEnd() != null && sw.getLicenseEnd().isBefore(java.time.LocalDate.now())) {
                throw new IllegalStateException("Лицензия ПО истекла");
            }
            if ("Обновление ПО".equals(cmd.type())) {
                findInstalledProduct(cmd.assetInventoryNo(), sw.getName());
            }
            if ("Установка ПО".equals(cmd.type()) && softwareInstallationRepository
                    .existsByAssetInventoryNoAndSoftwareId(cmd.assetInventoryNo(), cmd.softwareId())) {
                throw new IllegalStateException("ПО уже установлено на данное оборудование");
            }
        }
        if ("Обновление ПО".equals(cmd.type())) {
            if (cmd.assetInventoryNo() == null || cmd.assetInventoryNo().isBlank()) {
                throw new IllegalArgumentException("assetInventoryNo is required");
            }
            if (cmd.softwareId() == null) {
                throw new IllegalArgumentException("softwareId is required");
            }
            if (cmd.targetSoftwareVersion() == null || cmd.targetSoftwareVersion().isBlank()) {
                throw new IllegalArgumentException("targetSoftwareVersion is required");
            }
            SoftwareEntity sw = softwareRepository.findById(cmd.softwareId())
                    .orElseThrow(() -> new IllegalArgumentException("software not found: " + cmd.softwareId()));
            String targetVersion = cmd.targetSoftwareVersion().trim();
            if (!targetVersion.equals(sw.getVersion())) {
                throw new IllegalStateException("Целевая версия должна быть выбрана из реестра ПО");
            }
            SoftwareInstallationEntity inst = findInstalledProduct(cmd.assetInventoryNo(), sw.getName());
            if (cmd.softwareId().equals(inst.getSoftwareId()) || targetVersion.equals(inst.getInstalledVersion())) {
                throw new IllegalStateException("На оборудовании уже установлена выбранная версия");
            }
        }

        Long newStatusId = ticketStatusRepository.findByName("Новая").orElseThrow().getId();

        // Номер заявки строится из года и последовательного номера внутри года
        int year = sequenceService.currentYear();
        int next = sequenceService.nextForYear("ticket", year);
        String ticketNo = "T-" + year + "-" + String.format("%04d", next);

        TicketEntity t = new TicketEntity();
        t.setTicketNo(ticketNo);
        t.setType(cmd.type());
        t.setCategory(cmd.category());
        t.setAuthorEmployeeNo(cmd.authorEmployeeNo());
        t.setAssigneeEmployeeNo(null);
        t.setAssetInventoryNo(cmd.assetInventoryNo());
        t.setSoftwareId(cmd.softwareId());
        t.setTargetSoftwareVersion(cmd.targetSoftwareVersion() != null ? cmd.targetSoftwareVersion().trim() : null);
        t.setJustification(cmd.justification());
        t.setComment(null);
        t.setCreatedAt(LocalDateTime.now());
        t.setClosedAt(null);
        t.setStatusId(newStatusId);

        TicketEntity saved = ticketRepository.save(t);

        // Автор получает уведомление, что его заявка создана
        notificationService.notifyTicket(
                saved.getAuthorEmployeeNo(),
                "Заявка создана: " + saved.getTicketNo(),
                "Статус: Новая",
                saved.getTicketNo(),
                "TICKET_CREATED"
        );

        // IT-специалисты и менеджеры получают уведомление о новой заявке
        String notifyBody = "Тип: " + saved.getType()
                + (saved.getAssetInventoryNo() != null ? "; Оборудование: " + saved.getAssetInventoryNo() : "")
                + (saved.getTargetSoftwareVersion() != null ? "; Целевая версия: " + saved.getTargetSoftwareVersion() : "")
                + (saved.getJustification() != null ? "; Обоснование: " + saved.getJustification() : "");
        for (String roleName : List.of("IT_SPECIALIST", "IT_MANAGER")) {
            Long roleId = roleRepository.findByName(roleName).map(RoleEntity::getId).orElse(-1L);
            for (EmployeeEntity emp : employeeRepository.findByRoleIdOrderByEmployeeNo(roleId)) {
                if (!emp.getEmployeeNo().equals(saved.getAuthorEmployeeNo())) {
                    notificationService.notifyTicket(
                            emp.getEmployeeNo(),
                            "Новая заявка: " + saved.getTicketNo(),
                            notifyBody,
                            saved.getTicketNo(),
                            "TICKET_CREATED"
                    );
                }
            }
        }

        // Ремонтная заявка автоматически переводит связанный актив в статус Ремонт
        if ("Ремонт оборудования".equals(saved.getType()) && saved.getAssetInventoryNo() != null) {
            assetRepository.findById(saved.getAssetInventoryNo()).ifPresent(asset -> {
                assetStatusRepository.findByName("Ремонт").ifPresent(status -> {
                    asset.setStatusId(status.getId());
                    assetRepository.save(asset);
                });
            });
        }

        auditService.log(saved.getAuthorEmployeeNo(), "TICKET_CREATED", "ticketNo=" + saved.getTicketNo() + "; type=" + saved.getType());
        return saved;
    }

    @Transactional
    public TicketEntity assignToMe(String ticketNo, String assigneeEmployeeNo) {
        // Исполнитель может взять только открытую и ещё не назначенную заявку
        if (ticketNo == null || ticketNo.isBlank()) {
            throw new IllegalArgumentException("ticketNo is required");
        }
        if (assigneeEmployeeNo == null || assigneeEmployeeNo.isBlank()) {
            throw new IllegalArgumentException("assigneeEmployeeNo is required");
        }
        TicketEntity t = ticketRepository.findById(ticketNo).orElseThrow();
        if (t.getClosedAt() != null) {
            throw new IllegalStateException("Заявка уже закрыта");
        }
        if (t.getAssigneeEmployeeNo() != null && !t.getAssigneeEmployeeNo().isBlank()) {
            return t;
        }
        if (assigneeEmployeeNo.equals(t.getAuthorEmployeeNo())) {
            throw new IllegalStateException("Нельзя взять собственную заявку в работу");
        }
        t.setAssigneeEmployeeNo(assigneeEmployeeNo);
        ticketStatusRepository.findByName("В работе").ifPresent(s -> t.setStatusId(s.getId()));
        TicketEntity saved = ticketRepository.save(t);

        String assigneeName = employeeRepository.findById(assigneeEmployeeNo)
                .map(e -> e.getLastName() + " " + e.getFirstName())
                .orElse(assigneeEmployeeNo);
        notificationService.notifyTicket(
                saved.getAuthorEmployeeNo(),
                "Заявка взята в работу: " + saved.getTicketNo(),
                "Исполнитель: " + assigneeName,
                saved.getTicketNo(),
                "TICKET_ASSIGNED"
        );

        auditService.log(assigneeEmployeeNo, "TICKET_ASSIGNED", "ticketNo=" + saved.getTicketNo() + "; assignee=" + assigneeEmployeeNo);
        return saved;
    }

    @Transactional
    public TicketEntity changeStatus(String ticketNo, String newStatusName, String comment, String actorEmployeeNo, boolean keepInRepair) {
        // Смена статуса управляет закрытием заявки и побочными изменениями активов или ПО
        if (ticketNo == null || ticketNo.isBlank()) {
            throw new IllegalArgumentException("ticketNo is required");
        }
        if (newStatusName == null || newStatusName.isBlank()) {
            throw new IllegalArgumentException("newStatusName is required");
        }
        TicketEntity t = ticketRepository.findById(ticketNo).orElseThrow();
        if (t.getClosedAt() != null) {
            throw new IllegalStateException("Заявка уже закрыта и не может быть изменена");
        }
        String currentStatusName = ticketStatusRepository.findById(t.getStatusId())
                .map(s -> s.getName()).orElse("");
        if (currentStatusName.equals(newStatusName)) {
            throw new IllegalStateException("Заявка уже в этом статусе");
        }
        // Допустимые переходы защищают заявку от скачков между несовместимыми статусами
        java.util.Map<String, java.util.Set<String>> allowed = java.util.Map.of(
                "Новая", java.util.Set.of("В работе", "Отклонена"),
                "В работе", java.util.Set.of("Выполнена", "Отклонена")
        );
        java.util.Set<String> allowedNext = allowed.get(currentStatusName);
        if (allowedNext != null && !allowedNext.contains(newStatusName)) {
            throw new IllegalStateException("Недопустимый переход: " + currentStatusName + " → " + newStatusName);
        }
        Long newStatusId = ticketStatusRepository.findByName(newStatusName).orElseThrow().getId();
        t.setStatusId(newStatusId);
        if (comment != null && !comment.isBlank()) {
            t.setComment(comment);
        }
        if ("Выполнена".equals(newStatusName) || "Отклонена".equals(newStatusName)) {
            t.setClosedAt(LocalDateTime.now());
        }

        TicketEntity saved = ticketRepository.save(t);

        boolean isClosingStatus = "Выполнена".equals(newStatusName) || "Отклонена".equals(newStatusName);
        boolean skipStatusReset = "Отклонена".equals(newStatusName) && keepInRepair;
        // При закрытии ремонтной заявки актив возвращается в рабочий статус, если его не оставили в ремонте
        if (isClosingStatus
                && !skipStatusReset
                && "Ремонт оборудования".equals(saved.getType())
                && saved.getAssetInventoryNo() != null) {
            assetRepository.findById(saved.getAssetInventoryNo()).ifPresent(asset -> {
                String assetStatusName = assetStatusRepository.findById(asset.getStatusId())
                        .map(AssetStatusEntity::getName).orElse("");
                if ("Списано".equals(assetStatusName)) return;
                boolean stillIssued = !assetMovementActRepository
                        .findOpenIssuesByAssetInventoryNo(saved.getAssetInventoryNo()).isEmpty();
                String targetStatus = stillIssued ? "Эксплуатация" : "На складе";
                assetStatusRepository.findByName(targetStatus).ifPresent(st -> {
                    asset.setStatusId(st.getId());
                    assetRepository.save(asset);
                });
            });
        }

        if ("Выполнена".equals(newStatusName)
                && ("Установка ПО".equals(saved.getType()) || "Обновление ПО".equals(saved.getType()))
                && saved.getAssetInventoryNo() != null && saved.getSoftwareId() != null) {
            // Установка создаёт новую связь с активом, а обновление меняет версию уже установленного ПО
            SoftwareEntity sw = softwareRepository.findById(saved.getSoftwareId()).orElse(null);
            if (sw == null) {
                throw new IllegalArgumentException("software not found: " + saved.getSoftwareId());
            }
            if (sw.getLicenseEnd() != null && sw.getLicenseEnd().isBefore(java.time.LocalDate.now())) {
                throw new IllegalStateException("Лицензия ПО истекла — автоустановка невозможна. Обновите лицензию.");
            }
            boolean alreadyInstalled = softwareInstallationRepository
                    .existsByAssetInventoryNoAndSoftwareId(saved.getAssetInventoryNo(), saved.getSoftwareId());
            if ("Обновление ПО".equals(saved.getType())) {
                String targetVersion = saved.getTargetSoftwareVersion();
                if (targetVersion == null || targetVersion.isBlank()) {
                    targetVersion = sw.getVersion();
                }
                targetVersion = targetVersion.trim();
                if (!targetVersion.equals(sw.getVersion())) {
                    throw new IllegalStateException("Целевая версия должна быть выбрана из реестра ПО");
                }
                SoftwareInstallationEntity inst = findInstalledProduct(saved.getAssetInventoryNo(), sw.getName());
                String oldVersion = inst.getInstalledVersion();
                if (saved.getSoftwareId().equals(inst.getSoftwareId()) || targetVersion.equals(oldVersion)) {
                    throw new IllegalStateException("На оборудовании уже установлена выбранная версия");
                }
                Long oldSoftwareId = inst.getSoftwareId();
                inst.setSoftwareId(saved.getSoftwareId());
                inst.setInstalledVersion(targetVersion);
                inst.setUpdatedAt(LocalDateTime.now());
                softwareInstallationRepository.save(inst);
                auditService.log(actorEmployeeNo, "SOFTWARE_UPDATED_ON_ASSET",
                        "softwareId=" + oldSoftwareId + "→" + saved.getSoftwareId() + "; asset=" + saved.getAssetInventoryNo() + "; version=" + oldVersion + "→" + targetVersion + " (via ticket)");
                notifyAssetHolderSoftwareChanged(saved.getAssetInventoryNo(),
                        "ПО на вашем устройстве обновлено",
                        sw.getName() + ": " + oldVersion + " → " + targetVersion + "; Инв. №: " + saved.getAssetInventoryNo(),
                        saved.getTicketNo(),
                        "SOFTWARE_UPDATED");
            }
            if ("Установка ПО".equals(saved.getType()) && !alreadyInstalled) {
                SoftwareInstallationEntity inst = new SoftwareInstallationEntity();
                inst.setAssetInventoryNo(saved.getAssetInventoryNo());
                inst.setSoftwareId(saved.getSoftwareId());
                inst.setInstalledAt(LocalDateTime.now());
                inst.setInstalledVersion(sw.getVersion());
                inst.setUpdatedAt(null);
                softwareInstallationRepository.save(inst);
                auditService.log(actorEmployeeNo, "SOFTWARE_INSTALLED",
                        "softwareId=" + saved.getSoftwareId() + "; asset=" + saved.getAssetInventoryNo() + " (auto via ticket)");
                notifyAssetHolderSoftwareChanged(saved.getAssetInventoryNo(),
                        "На ваше устройство установлено ПО",
                        sw.getName() + " " + sw.getVersion() + "; Инв. №: " + saved.getAssetInventoryNo(),
                        saved.getTicketNo(),
                        "SOFTWARE_INSTALLED");
            }
        }

        notificationService.notifyTicket(
                saved.getAuthorEmployeeNo(),
                "Статус заявки изменен: " + saved.getTicketNo(),
                "Новый статус: " + newStatusName,
                saved.getTicketNo(),
                "TICKET_STATUS_CHANGED"
        );

        auditService.log(actorEmployeeNo, "TICKET_STATUS_CHANGED", "ticketNo=" + saved.getTicketNo() + "; status=" + newStatusName);
        return saved;
    }

    public record CreateTicketCommand(
            String type,
            String category,
            String authorEmployeeNo,
            String assetInventoryNo,
            Long softwareId,
            String targetSoftwareVersion,
            String justification
    ) {}
}
