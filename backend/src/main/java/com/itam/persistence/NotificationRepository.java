package com.itam.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<NotificationEntity, Long> {
    // Лента уведомлений пользователя с пагинацией и сортировкой по дате
    Page<NotificationEntity> findByRecipientEmployeeNoOrderByCreatedAtDesc(String recipientEmployeeNo, Pageable pageable);

    // Счётчик непрочитанных уведомлений для бейджа в sidebar
    long countByRecipientEmployeeNoAndReadFalse(String recipientEmployeeNo);
}
