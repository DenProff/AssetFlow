package com.itam.api;

import com.itam.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
// Контроллер справочников отдаёт данные для select-списков и базовых классификаторов
@RequestMapping("/reference")
public class ReferenceController {

    private final AssetTypeRepository assetTypeRepository;
    private final AssetStatusRepository assetStatusRepository;
    private final TicketStatusRepository ticketStatusRepository;
    private final LicenseTypeRepository licenseTypeRepository;
    private final LicenseStatusRepository licenseStatusRepository;
    private final RoleRepository roleRepository;
    private final OkofRepository okofRepository;
    private final AmortizationGroupRepository amortizationGroupRepository;
    private final AssetRepository assetRepository;

    public ReferenceController(
            AssetTypeRepository assetTypeRepository,
            AssetStatusRepository assetStatusRepository,
            TicketStatusRepository ticketStatusRepository,
            LicenseTypeRepository licenseTypeRepository,
            LicenseStatusRepository licenseStatusRepository,
            RoleRepository roleRepository,
            OkofRepository okofRepository,
            AmortizationGroupRepository amortizationGroupRepository,
            AssetRepository assetRepository
    ) {
        this.assetTypeRepository = assetTypeRepository;
        this.assetStatusRepository = assetStatusRepository;
        this.ticketStatusRepository = ticketStatusRepository;
        this.licenseTypeRepository = licenseTypeRepository;
        this.licenseStatusRepository = licenseStatusRepository;
        this.roleRepository = roleRepository;
        this.okofRepository = okofRepository;
        this.amortizationGroupRepository = amortizationGroupRepository;
        this.assetRepository = assetRepository;
    }

    @GetMapping("/asset-types")
    public List<AssetTypeEntity> assetTypes() {
        // Типы активов содержат связанную информацию по ОКОФ и амортизационной группе
        return assetTypeRepository.findAll();
    }

    public record CreateAssetTypeRequest(
            @NotBlank String name,
            @NotNull @Min(1) Integer defaultUsefulLifeYears,
            String okofCode
    ) {}

    @PostMapping("/asset-types")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetTypeEntity createAssetType(@RequestBody @Valid CreateAssetTypeRequest req) {
        if (assetTypeRepository.findAll().stream().anyMatch(t -> t.getName().equalsIgnoreCase(req.name()))) {
            throw new IllegalArgumentException("asset type with this name already exists");
        }
        AssetTypeEntity t = new AssetTypeEntity();
        t.setName(req.name());
        t.setDefaultUsefulLifeYears(req.defaultUsefulLifeYears());
        if (req.okofCode() != null && !req.okofCode().isBlank()) {
            OkofEntity okof = okofRepository.findById(req.okofCode())
                    .orElseThrow(() -> new IllegalArgumentException("unknown OKOF code: " + req.okofCode()));
            t.setOkof(okof);
        }
        return assetTypeRepository.save(t);
    }

    public record UpdateAssetTypeRequest(
            @NotBlank String name,
            @NotNull @Min(1) Integer defaultUsefulLifeYears,
            String okofCode
    ) {}

    @PutMapping("/asset-types/{id}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public AssetTypeEntity updateAssetType(@PathVariable Long id, @RequestBody @Valid UpdateAssetTypeRequest req) {
        AssetTypeEntity t = assetTypeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("asset type not found: " + id));
        boolean nameConflict = assetTypeRepository.findAll().stream()
                .anyMatch(x -> !x.getId().equals(id) && x.getName().equalsIgnoreCase(req.name()));
        if (nameConflict) throw new IllegalArgumentException("asset type with this name already exists");
        t.setName(req.name());
        t.setDefaultUsefulLifeYears(req.defaultUsefulLifeYears());
        if (req.okofCode() != null && !req.okofCode().isBlank()) {
            OkofEntity okof = okofRepository.findById(req.okofCode())
                    .orElseThrow(() -> new IllegalArgumentException("unknown OKOF code: " + req.okofCode()));
            t.setOkof(okof);
        } else {
            t.setOkof(null);
        }
        return assetTypeRepository.save(t);
    }

    @DeleteMapping("/asset-types/{id}")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public void deleteAssetType(@PathVariable Long id) {
        if (!assetTypeRepository.existsById(id))
            throw new IllegalArgumentException("asset type not found: " + id);
        // Тип актива нельзя удалить, если он уже используется в карточках активов
        long inUse = assetRepository.countByTypeId(id);
        if (inUse > 0)
            throw new IllegalArgumentException("Нельзя удалить: тип используется в " + inUse + " активах");
        assetTypeRepository.deleteById(id);
    }

    @GetMapping("/okof")
    public List<OkofEntity> okofList() {
        // ОКОФ используется для классификации типов активов и связи с амортизационной группой
        return okofRepository.findAll();
    }

    public record CreateOkofRequest(
            @NotBlank String code,
            @NotBlank String name,
            @NotNull Short amortizationGroupNo
    ) {}

    @PostMapping("/okof")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public OkofEntity createOkof(@RequestBody @Valid CreateOkofRequest req) {
        if (okofRepository.existsById(req.code())) {
            throw new IllegalArgumentException("OKOF code already exists: " + req.code());
        }
        AmortizationGroupEntity group = amortizationGroupRepository.findById(req.amortizationGroupNo())
                .orElseThrow(() -> new IllegalArgumentException("unknown amortization group: " + req.amortizationGroupNo()));
        OkofEntity okof = new OkofEntity();
        // Новый код ОКОФ обязательно привязывается к существующей амортизационной группе
        okof.setCode(req.code());
        okof.setName(req.name());
        okof.setAmortizationGroup(group);
        return okofRepository.save(okof);
    }

    @GetMapping("/amortization-groups")
    public List<AmortizationGroupEntity> amortizationGroups() {
        return amortizationGroupRepository.findAll();
    }

    @GetMapping("/asset-statuses")
    public List<AssetStatusEntity> assetStatuses() {
        return assetStatusRepository.findAll();
    }

    @GetMapping("/ticket-statuses")
    public List<TicketStatusEntity> ticketStatuses() {
        return ticketStatusRepository.findAll();
    }

    @GetMapping("/license-types")
    public List<LicenseTypeEntity> licenseTypes() {
        return licenseTypeRepository.findAll();
    }

    @GetMapping("/license-statuses")
    public List<LicenseStatusEntity> licenseStatuses() {
        return licenseStatusRepository.findAll();
    }

    @GetMapping("/roles")
    public List<RoleEntity> roles() {
        return roleRepository.findAll();
    }
}
