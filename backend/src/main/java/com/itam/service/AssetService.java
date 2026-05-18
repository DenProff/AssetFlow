package com.itam.service;

import com.itam.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class AssetService {

    private final AssetRepository assetRepository;
    private final AssetTypeRepository assetTypeRepository;
    private final AssetStatusRepository assetStatusRepository;
    private final SequenceService sequenceService;
    private final AuditService auditService;
    private final NotificationService notificationService;
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final AssetMovementActRepository assetMovementActRepository;

    public AssetService(
            AssetRepository assetRepository,
            AssetTypeRepository assetTypeRepository,
            AssetStatusRepository assetStatusRepository,
            SequenceService sequenceService,
            AuditService auditService,
            NotificationService notificationService,
            EmployeeRepository employeeRepository,
            RoleRepository roleRepository,
            AssetMovementActRepository assetMovementActRepository
    ) {
        this.assetRepository = assetRepository;
        this.assetTypeRepository = assetTypeRepository;
        this.assetStatusRepository = assetStatusRepository;
        this.sequenceService = sequenceService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.assetMovementActRepository = assetMovementActRepository;
    }

    @Transactional
    public AssetEntity createAsset(CreateAssetCommand cmd, String actorEmployeeNo) {
        // Создание актива выполняется одной транзакцией вместе с аудитом и уведомлениями
        if (cmd == null || cmd.typeId() == null) {
            throw new IllegalArgumentException("typeId is required");
        }
        if (cmd.serialNumber() == null || cmd.serialNumber().isBlank()) {
            throw new IllegalArgumentException("serialNumber is required");
        }
        if (cmd.purchaseDate() != null && cmd.purchaseDate().isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("purchaseDate must be <= today");
        }
        if (assetRepository.existsBySerialNumber(cmd.serialNumber())) {
            throw new IllegalArgumentException("serialNumber must be unique");
        }

        AssetTypeEntity type = assetTypeRepository.findById(cmd.typeId()).orElseThrow();
        Long statusId = assetStatusRepository.findByName("На складе").orElseThrow().getId();

        // Инвентарный номер и номер ОС-1 генерируются отдельными последовательностями
        int year = sequenceService.currentYear();
        int next = sequenceService.nextForYear("asset_it", year);
        String inventoryNo = "IT-" + year + "-" + String.format("%04d", next);

        int os1next = sequenceService.nextForYear("os1", year);
        String receiptActNo = "\u041e\u0421-1-" + year + "-" + String.format("%04d", os1next);

        AssetEntity a = new AssetEntity();
        a.setInventoryNo(inventoryNo);
        a.setTypeId(type.getId());
        a.setManufacturer(cmd.manufacturer());
        a.setModel(cmd.model());
        a.setSerialNumber(cmd.serialNumber());
        a.setPurchaseDate(cmd.purchaseDate());
        a.setCost(cmd.cost());
        a.setStatusId(statusId);
        a.setVendorName(cmd.vendorName());
        a.setReceiptActNo(receiptActNo);

        AssetEntity saved = assetRepository.save(a);
        auditService.log(actorEmployeeNo, "ASSET_CREATED", "inventoryNo=" + saved.getInventoryNo() + "; serial=" + saved.getSerialNumber());

        // IT-роли получают уведомление о новом оборудовании
        String notifyBody = "Инв. №: " + saved.getInventoryNo() + "; " + type.getName() + " — " + cmd.manufacturer() + " " + cmd.model();
        for (String roleName : List.of("IT_SPECIALIST", "IT_MANAGER")) {
            Long roleId = roleRepository.findByName(roleName).map(RoleEntity::getId).orElse(-1L);
            for (EmployeeEntity emp : employeeRepository.findByRoleIdOrderByEmployeeNo(roleId)) {
                notificationService.notifyTicket(emp.getEmployeeNo(),
                        "Новое оборудование добавлено", notifyBody, null, "ASSET_CREATED");
            }
        }
        return saved;
    }

    public record CreateAssetCommand(
            Long typeId,
            String manufacturer,
            String model,
            String serialNumber,
            java.time.LocalDate purchaseDate,
            java.math.BigDecimal cost,
            String vendorName
    ) {}

    @Transactional
    public AssetEntity updateAsset(String inventoryNo, UpdateAssetCommand cmd, String actorEmployeeNo) {
        AssetEntity a = assetRepository.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));
        // Серийный номер должен оставаться уникальным среди всех активов
        if (!a.getSerialNumber().equals(cmd.serialNumber()) &&
                assetRepository.existsBySerialNumber(cmd.serialNumber())) {
            throw new IllegalArgumentException("serialNumber must be unique");
        }
        assetTypeRepository.findById(cmd.typeId())
                .orElseThrow(() -> new IllegalArgumentException("typeId not found: " + cmd.typeId()));
        List<String> changes = new ArrayList<>();
        // В аудит записываются только реально изменённые поля
        if (!Objects.equals(a.getTypeId(), cmd.typeId()))         changes.add("type: " + a.getTypeId() + "→" + cmd.typeId());
        if (!Objects.equals(a.getManufacturer(), cmd.manufacturer())) changes.add("manufacturer: " + a.getManufacturer() + "→" + cmd.manufacturer());
        if (!Objects.equals(a.getModel(), cmd.model()))           changes.add("model: " + a.getModel() + "→" + cmd.model());
        if (!Objects.equals(a.getSerialNumber(), cmd.serialNumber())) changes.add("serial: " + a.getSerialNumber() + "→" + cmd.serialNumber());
        if (!Objects.equals(a.getPurchaseDate(), cmd.purchaseDate())) changes.add("purchaseDate: " + a.getPurchaseDate() + "→" + cmd.purchaseDate());
        if (a.getCost() == null ? cmd.cost() != null : cmd.cost() == null || a.getCost().compareTo(cmd.cost()) != 0) changes.add("cost: " + a.getCost() + "→" + cmd.cost());
        if (!Objects.equals(a.getVendorName(), cmd.vendorName())) changes.add("vendor: " + a.getVendorName() + "→" + cmd.vendorName());
        if (changes.isEmpty()) return a;
        a.setTypeId(cmd.typeId());
        a.setManufacturer(cmd.manufacturer());
        a.setModel(cmd.model());
        a.setSerialNumber(cmd.serialNumber());
        a.setPurchaseDate(cmd.purchaseDate());
        a.setCost(cmd.cost());
        a.setVendorName(cmd.vendorName());
        AssetEntity saved = assetRepository.save(a);
        auditService.log(actorEmployeeNo, "ASSET_UPDATED", "inventoryNo=" + inventoryNo + "; " + String.join("; ", changes));
        return saved;
    }

    @Transactional
    public void deleteAsset(String inventoryNo, String actorEmployeeNo) {
        AssetEntity a = assetRepository.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));
        Long onStorageId = assetStatusRepository.findByName("На складе").orElseThrow().getId();
        // Удалять можно только складские активы, чтобы не потерять выданное или списанное оборудование
        if (!onStorageId.equals(a.getStatusId())) {
            throw new IllegalStateException("Удалить можно только актив со статусом 'На складе'");
        }
        assetRepository.deleteById(inventoryNo);
        auditService.log(actorEmployeeNo, "ASSET_DELETED", "inventoryNo=" + inventoryNo);
    }

    @Transactional
    public AssetEntity changeStatus(String inventoryNo, String newStatusName, String actorEmployeeNo) {
        AssetEntity a = assetRepository.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));
        String currentName = assetStatusRepository.findById(a.getStatusId())
                .map(s -> s.getName()).orElse("");
        // Списанный актив считается финальным состоянием и не возвращается в работу
        if ("Списано".equals(currentName)) {
            throw new IllegalStateException("Нельзя изменить статус списанного актива");
        }
        if ("Эксплуатация".equals(newStatusName)) {
            // Эксплуатация разрешена только после ремонта и при наличии открытого акта выдачи
            if (!"Ремонт".equals(currentName)) {
                throw new IllegalStateException("Статус 'Эксплуатация' устанавливается через акт выдачи");
            }
            boolean hasOpenAct = !assetMovementActRepository
                    .findOpenIssuesByAssetInventoryNo(inventoryNo).isEmpty();
            if (!hasOpenAct) {
                throw new IllegalStateException("Нельзя вернуть в эксплуатацию — нет открытого акта выдачи. Создайте новый акт выдачи");
            }
        }
        if ("Списано".equals(newStatusName)) {
            throw new IllegalStateException("Статус 'Списано' устанавливается через акт списания");
        }
        if ("На складе".equals(newStatusName) && "Эксплуатация".equals(currentName)) {
            // Возврат из эксплуатации должен проходить через акт возврата
            throw new IllegalStateException("Нельзя вернуть на склад — оборудование на руках у сотрудника. Создайте акт возврата");
        }
        if ("На складе".equals(newStatusName)) {
            assetMovementActRepository.findOpenIssuesByAssetInventoryNo(inventoryNo).stream().findFirst().ifPresent(open -> {
                throw new IllegalStateException("Нельзя вернуть на склад — есть открытый акт выдачи " + open.getActNo() + ". Создайте акт возврата");
            });
        }
        AssetStatusEntity newStatus = assetStatusRepository.findByName(newStatusName)
                .orElseThrow(() -> new IllegalArgumentException("status not found: " + newStatusName));
        a.setStatusId(newStatus.getId());
        AssetEntity saved = assetRepository.save(a);
        auditService.log(actorEmployeeNo, "ASSET_STATUS_CHANGED",
                "inventoryNo=" + inventoryNo + "; status: " + currentName + "→" + newStatusName);
        return saved;
    }

    public record UpdateAssetCommand(
            Long typeId,
            String manufacturer,
            String model,
            String serialNumber,
            java.time.LocalDate purchaseDate,
            java.math.BigDecimal cost,
            String vendorName
    ) {}
}
