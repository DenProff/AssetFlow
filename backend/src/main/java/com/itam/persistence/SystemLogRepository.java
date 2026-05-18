package com.itam.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemLogRepository extends JpaRepository<SystemLogEntity, Long> {

    // Spring Data JPA строит запрос для фильтрации журнала по типу действия
    Page<SystemLogEntity> findByAction(String action, Pageable pageable);
}
