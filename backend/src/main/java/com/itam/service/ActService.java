package com.itam.service;

import com.itam.persistence.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class ActService {

    private final AssetRepository assetRepository;
    private final AssetStatusRepository assetStatusRepository;
    private final AssetMovementActRepository assetMovementActRepository;
    private final AssetWriteOffActRepository assetWriteOffActRepository;
    private final SequenceService sequenceService;
    private final AuditService auditService;
    private final TicketRepository ticketRepository;
    private final NotificationService notificationService;
    private final SoftwareInstallationRepository softwareInstallationRepository;

    public ActService(
            AssetRepository assetRepository,
            AssetStatusRepository assetStatusRepository,
            AssetMovementActRepository assetMovementActRepository,
            AssetWriteOffActRepository assetWriteOffActRepository,
            SequenceService sequenceService,
            AuditService auditService,
            TicketRepository ticketRepository,
            NotificationService notificationService,
            SoftwareInstallationRepository softwareInstallationRepository
    ) {
        this.assetRepository = assetRepository;
        this.assetStatusRepository = assetStatusRepository;
        this.assetMovementActRepository = assetMovementActRepository;
        this.assetWriteOffActRepository = assetWriteOffActRepository;
        this.sequenceService = sequenceService;
        this.auditService = auditService;
        this.ticketRepository = ticketRepository;
        this.notificationService = notificationService;
        this.softwareInstallationRepository = softwareInstallationRepository;
    }

    @Transactional
    public AssetMovementActEntity issueAsset(String inventoryNo, String employeeNo, LocalDate issueDate, String actorEmployeeNo) {
        // Выдача актива создаёт ОС-2 и переводит актив в статус Эксплуатация
        if (inventoryNo == null || inventoryNo.isBlank()) {
            throw new IllegalArgumentException("inventoryNo is required");
        }
        if (employeeNo == null || employeeNo.isBlank()) {
            throw new IllegalArgumentException("employeeNo is required");
        }
        if (issueDate == null) {
            throw new IllegalArgumentException("issueDate is required");
        }
        if (actorEmployeeNo == null || actorEmployeeNo.isBlank()) {
            throw new IllegalArgumentException("actorEmployeeNo is required");
        }

        AssetEntity asset = assetRepository.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));

        Long writtenOffId = assetStatusRepository.findByName("Списано").orElseThrow().getId();
        if (writtenOffId.equals(asset.getStatusId())) {
            throw new IllegalStateException("asset is written off and cannot be issued");
        }

        Long repairStatusId = assetStatusRepository.findByName("Ремонт").map(s -> s.getId()).orElse(-1L);
        if (repairStatusId.equals(asset.getStatusId())) {
            throw new IllegalStateException("Невозможно выдать актив: оборудование находится в ремонте");
        }

        // Открытый акт выдачи означает, что актив уже находится у сотрудника
        if (!assetMovementActRepository.findOpenIssuesByAssetInventoryNo(inventoryNo).isEmpty()) {
            throw new IllegalStateException("asset is already issued (open issue act exists)");
        }

        Long exploitationStatusId = assetStatusRepository.findByName("Эксплуатация").orElseThrow().getId();
        asset.setStatusId(exploitationStatusId);
        assetRepository.save(asset);

        // Номер ОС-2 генерируется отдельно от инвентарных номеров и других актов
        int year = sequenceService.currentYear();
        int next = sequenceService.nextForYear("os2", year);
        String actNo = "ОС-2-" + String.format("%04d", year) + "-" + String.format("%04d", next);

        AssetMovementActEntity act = new AssetMovementActEntity();
        act.setActNo(actNo);
        act.setAssetInventoryNo(inventoryNo);
        act.setEmployeeNo(employeeNo);
        act.setActorEmployeeNo(actorEmployeeNo);
        act.setMovementType("ISSUE");
        act.setMovementDate(issueDate);
        act.setRelatedActNo(null);

        AssetMovementActEntity saved = assetMovementActRepository.save(act);
        auditService.log(actorEmployeeNo, "ASSET_ISSUED", "actNo=" + actNo + "; inventoryNo=" + inventoryNo + "; employeeNo=" + employeeNo);
        notificationService.notifyTicket(employeeNo,
                "Вам выдано оборудование",
                "Инв. №: " + inventoryNo + "; Акт: " + actNo, null, "ASSET_ISSUED");
        return saved;
    }

    @Transactional
    public AssetMovementActEntity returnAsset(String actNo, LocalDate returnDate, String actorEmployeeNo) {
        // Возврат закрывает ОС-2 и возвращает актив на склад или в ремонт
        if (actNo == null || actNo.isBlank()) {
            throw new IllegalArgumentException("actNo is required");
        }
        if (returnDate == null) {
            throw new IllegalArgumentException("returnDate is required");
        }
        if (actorEmployeeNo == null || actorEmployeeNo.isBlank()) {
            throw new IllegalArgumentException("actorEmployeeNo is required");
        }

        AssetMovementActEntity act = assetMovementActRepository.findById(actNo)
                .orElseThrow(() -> new IllegalArgumentException("act not found: " + actNo));

        if (!"ISSUE".equals(act.getMovementType())) {
            throw new IllegalStateException("return can be created only for issue act");
        }
        boolean stillOpen = assetMovementActRepository.findOpenIssuesByAssetInventoryNo(act.getAssetInventoryNo()).stream()
                .anyMatch(open -> open.getActNo().equals(act.getActNo()));
        if (!stillOpen) {
            throw new IllegalStateException("act is already returned");
        }
        if (returnDate.isBefore(act.getMovementDate())) {
            throw new IllegalArgumentException("returnDate must be >= issueDate");
        }

        int year = sequenceService.currentYear();
        int next = sequenceService.nextForYear("os2", year);
        String returnActNo = "ОС-2-" + String.format("%04d", year) + "-" + String.format("%04d", next);

        AssetMovementActEntity returnAct = new AssetMovementActEntity();
        returnAct.setActNo(returnActNo);
        returnAct.setAssetInventoryNo(act.getAssetInventoryNo());
        returnAct.setEmployeeNo(act.getEmployeeNo());
        returnAct.setActorEmployeeNo(actorEmployeeNo);
        returnAct.setMovementType("RETURN");
        returnAct.setMovementDate(returnDate);
        returnAct.setRelatedActNo(act.getActNo());
        AssetMovementActEntity saved = assetMovementActRepository.save(returnAct);

        AssetEntity asset = assetRepository.findById(act.getAssetInventoryNo()).orElseThrow();
        // Если по активу есть открытая ремонтная заявка, после возврата он остаётся в ремонте
        boolean hasOpenRepair = !ticketRepository.findOpenByAssetInventoryNo(act.getAssetInventoryNo()).stream()
                .filter(t -> "Ремонт оборудования".equals(t.getType()))
                .toList().isEmpty();
        String targetStatusName = hasOpenRepair ? "Ремонт" : "На складе";
        assetStatusRepository.findByName(targetStatusName).ifPresent(st -> {
            asset.setStatusId(st.getId());
            assetRepository.save(asset);
        });

        auditService.log(actorEmployeeNo, "ASSET_RETURNED", "actNo=" + actNo + "; returnActNo=" + returnActNo + "; returnDate=" + returnDate);
        notificationService.notifyTicket(act.getEmployeeNo(),
                "Оборудование возвращено",
                "Инв. №: " + act.getAssetInventoryNo() + "; Акт сдачи: " + returnActNo, null, "ASSET_RETURNED");
        return saved;
    }

    @Transactional
    public AssetWriteOffActEntity writeOff(String inventoryNo, String reason, LocalDate writeOffDate, String actorEmployeeNo) {
        // Списание создаёт ОС-4 и переводит актив в финальный статус Списано
        if (inventoryNo == null || inventoryNo.isBlank()) {
            throw new IllegalArgumentException("inventoryNo is required");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("reason is required");
        }
        if (writeOffDate == null) {
            throw new IllegalArgumentException("writeOffDate is required");
        }
        if (actorEmployeeNo == null || actorEmployeeNo.isBlank()) {
            throw new IllegalArgumentException("actorEmployeeNo is required");
        }

        AssetEntity asset = assetRepository.findById(inventoryNo)
                .orElseThrow(() -> new IllegalArgumentException("asset not found: " + inventoryNo));

        Long writtenOffId = assetStatusRepository.findByName("Списано").orElseThrow().getId();
        if (writtenOffId.equals(asset.getStatusId())) {
            throw new IllegalStateException("asset is already written off");
        }

        // Нельзя списать актив, пока он числится на руках у сотрудника
        assetMovementActRepository.findOpenIssuesByAssetInventoryNo(inventoryNo).stream().findFirst().ifPresent(open -> {
            throw new IllegalStateException("asset has open issue act " + open.getActNo() + "; return it before write-off");
        });

        asset.setStatusId(writtenOffId);
        assetRepository.save(asset);

        List<SoftwareInstallationEntity> installations = softwareInstallationRepository.findByAssetInventoryNo(inventoryNo);
        if (!installations.isEmpty()) {
            softwareInstallationRepository.deleteAll(installations);
            auditService.log(actorEmployeeNo, "SOFTWARE_UNINSTALLED_ON_WRITE_OFF",
                    "inventoryNo=" + inventoryNo + "; count=" + installations.size());
        }

        // Номер ОС-4 генерируется отдельной последовательностью актов списания
        int year = sequenceService.currentYear();
        int next = sequenceService.nextForYear("os4", year);
        String actNo = "ОС-4-" + String.format("%04d", year) + "-" + String.format("%04d", next);

        AssetWriteOffActEntity act = new AssetWriteOffActEntity();
        act.setActNo(actNo);
        act.setAssetInventoryNo(inventoryNo);
        act.setReason(reason);
        act.setWriteOffDate(writeOffDate);

        AssetWriteOffActEntity saved = assetWriteOffActRepository.save(act);
        auditService.log(actorEmployeeNo, "ASSET_WRITTEN_OFF", "actNo=" + actNo + "; inventoryNo=" + inventoryNo + "; reason=" + reason);
        return saved;
    }
}
