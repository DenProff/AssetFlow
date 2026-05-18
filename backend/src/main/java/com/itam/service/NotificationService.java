package com.itam.service;

import com.itam.persistence.NotificationEntity;
import com.itam.persistence.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
// Сервис создаёт уведомления, которые потом читает конкретный сотрудник
public class NotificationService {
    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public NotificationEntity notifyTicket(String recipientEmployeeNo, String title, String body, String ticketNo, String type) {
        // Универсальный метод используется не только заявками, но и активами, ПО и актами
        NotificationEntity n = new NotificationEntity();
        n.setRecipientEmployeeNo(recipientEmployeeNo);
        n.setCreatedAt(LocalDateTime.now());
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        if (ticketNo != null) {
            // Связанный номер заявки заполняется только для событий по заявкам
            n.setRelatedTicketNo(ticketNo);
        }
        n.setRead(false);
        return notificationRepository.save(n);
    }
}
