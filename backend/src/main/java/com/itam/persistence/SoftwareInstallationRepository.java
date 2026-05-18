package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SoftwareInstallationRepository extends JpaRepository<SoftwareInstallationEntity, Long> {

    // Получить всё ПО, установленное на конкретный актив
    List<SoftwareInstallationEntity> findByAssetInventoryNo(String assetInventoryNo);

    // Получить все активы, на которых установлено конкретное ПО
    List<SoftwareInstallationEntity> findBySoftwareId(Long softwareId);

    // Найти конкретную установку для удаления или проверки
    Optional<SoftwareInstallationEntity> findByAssetInventoryNoAndSoftwareId(String assetInventoryNo, Long softwareId);

    // Проверка защищает от повторной установки одного ПО на один актив
    boolean existsByAssetInventoryNoAndSoftwareId(String assetInventoryNo, Long softwareId);

    // Подсчёт установок нужен для отчётов и ограничений удаления
    long countBySoftwareId(Long softwareId);
}
