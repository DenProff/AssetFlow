package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AssetStatusRepository extends JpaRepository<AssetStatusEntity, Long> {
    Optional<AssetStatusEntity> findByName(String name);
}
