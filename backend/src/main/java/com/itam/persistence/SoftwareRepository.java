package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SoftwareRepository extends JpaRepository<SoftwareEntity, Long> {

    // Поиск по статусу лицензии идёт через FK на справочник license_status
    List<SoftwareEntity> findByLicenseStatusId(Long licenseStatusId);

    // Уникальной считается конкретная версия продукта
    boolean existsByNameAndVersion(String name, String version);

    boolean existsByNameAndVersionAndIdNot(String name, String version, Long id);
}
