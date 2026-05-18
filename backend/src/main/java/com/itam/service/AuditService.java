package com.itam.service;

import com.itam.persistence.SystemLogEntity;
import com.itam.persistence.SystemLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
// Сервис аудита централизованно записывает действия пользователей в журнал
public class AuditService {

    private final SystemLogRepository systemLogRepository;

    public AuditService(SystemLogRepository systemLogRepository) {
        this.systemLogRepository = systemLogRepository;
    }

    @Transactional
    public void log(String actorEmployeeNo, String action, String details) {
        // Каждая запись фиксирует кто, когда и какое действие выполнил
        SystemLogEntity e = new SystemLogEntity();
        e.setLoggedAt(LocalDateTime.now());
        e.setActorEmployeeNo(actorEmployeeNo);
        e.setAction(action);
        e.setDetails(details);
        systemLogRepository.save(e);
    }
}
