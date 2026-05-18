package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LicenseStatusRepository extends JpaRepository<LicenseStatusEntity, Long> {
    Optional<LicenseStatusEntity> findByName(String name);
}
