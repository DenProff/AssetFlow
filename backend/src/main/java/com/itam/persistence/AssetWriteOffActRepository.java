package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetWriteOffActRepository extends JpaRepository<AssetWriteOffActEntity, String> {

    // Используется в аналитике для подсчёта недавних списаний
    java.util.List<AssetWriteOffActEntity> findByWriteOffDateAfter(java.time.LocalDate date);
}
