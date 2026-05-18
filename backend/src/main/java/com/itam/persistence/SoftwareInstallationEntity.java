package com.itam.persistence;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
// Entity хранит факт установки конкретного ПО на конкретный актив
@Table(name = "software_installation")
public class SoftwareInstallationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "asset_inventory_no", nullable = false, length = 32)
    private String assetInventoryNo;

    @Column(name = "software_id", nullable = false)
    private Long softwareId;

    @Column(name = "installed_at", nullable = false)
    private LocalDateTime installedAt;

    @Column(name = "installed_version", nullable = false, length = 64)
    private String installedVersion;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAssetInventoryNo() { return assetInventoryNo; }
    public void setAssetInventoryNo(String assetInventoryNo) { this.assetInventoryNo = assetInventoryNo; }

    public Long getSoftwareId() { return softwareId; }
    public void setSoftwareId(Long softwareId) { this.softwareId = softwareId; }

    public LocalDateTime getInstalledAt() { return installedAt; }
    public void setInstalledAt(LocalDateTime installedAt) { this.installedAt = installedAt; }

    public String getInstalledVersion() { return installedVersion; }
    public void setInstalledVersion(String installedVersion) { this.installedVersion = installedVersion; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
