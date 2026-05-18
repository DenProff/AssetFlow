package com.itam.api;

import com.itam.persistence.SystemLogEntity;
import com.itam.persistence.SystemLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
// Контроллер журнала событий отдаёт audit log для IT-ролей
@RequestMapping("/system-logs")
public class SystemLogController {

    private final SystemLogRepository systemLogRepository;

    public SystemLogController(SystemLogRepository systemLogRepository) {
        this.systemLogRepository = systemLogRepository;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public Page<SystemLogEntity> list(
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        // Логи всегда сортируются от новых событий к старым
        PageRequest pr = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "loggedAt"));
        if (action != null && !action.isBlank()) {
            // Фильтр action позволяет смотреть события одного типа
            return systemLogRepository.findByAction(action, pr);
        }
        return systemLogRepository.findAll(pr);
    }
}
