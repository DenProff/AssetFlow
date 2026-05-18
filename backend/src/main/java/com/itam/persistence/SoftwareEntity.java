package com.itam.persistence;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
// Entity хранит карточку ПО, лицензию и сроки её действия
@Table(name = "software", uniqueConstraints = @UniqueConstraint(name = "uk_software_name_version", columnNames = {"name", "version"}))
public class SoftwareEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 256)
    private String name;

    @Column(nullable = false, length = 64)
    private String version;

    @Column(name = "license_type_id", nullable = false)
    private Long licenseTypeId;

    @Column(name = "license_identifier", length = 256)
    private String licenseIdentifier;

    @Column(name = "license_start")
    private LocalDate licenseStart;

    @Column(name = "license_end")
    private LocalDate licenseEnd;

    @Column(name = "license_status_id", nullable = false)
    private Long licenseStatusId;

    @Transient
    private String licenseStatus;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public Long getLicenseTypeId() { return licenseTypeId; }
    public void setLicenseTypeId(Long licenseTypeId) { this.licenseTypeId = licenseTypeId; }

    public String getLicenseIdentifier() { return licenseIdentifier; }
    public void setLicenseIdentifier(String licenseIdentifier) { this.licenseIdentifier = licenseIdentifier; }

    public LocalDate getLicenseStart() { return licenseStart; }
    public void setLicenseStart(LocalDate licenseStart) { this.licenseStart = licenseStart; }

    public LocalDate getLicenseEnd() { return licenseEnd; }
    public void setLicenseEnd(LocalDate licenseEnd) { this.licenseEnd = licenseEnd; }

    public Long getLicenseStatusId() { return licenseStatusId; }
    public void setLicenseStatusId(Long licenseStatusId) { this.licenseStatusId = licenseStatusId; }

    public String getLicenseStatus() { return licenseStatus; }
    public void setLicenseStatus(String licenseStatus) { this.licenseStatus = licenseStatus; }
}
