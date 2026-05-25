package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssetRepository extends JpaRepository<AssetEntity, String> {

    // Проверка уникальности серийного номера используется при создании и редактировании актива
    boolean existsBySerialNumber(String serialNumber);

    // Подсчёт активов по типу нужен, чтобы не удалить используемый тип оборудования
    long countByTypeId(Long typeId);

    // Универсальный поиск активов с необязательными фильтрами по статусу и типу
    @Query("select a from AssetEntity a where (:statusId is null or a.statusId = :statusId) and (:typeId is null or a.typeId = :typeId) order by a.inventoryNo")
    List<AssetEntity> search(@Param("statusId") Long statusId, @Param("typeId") Long typeId);
}
