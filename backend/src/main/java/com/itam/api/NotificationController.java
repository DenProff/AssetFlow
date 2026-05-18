package com.itam.api;

import com.itam.persistence.NotificationEntity;
import com.itam.persistence.NotificationRepository;
import com.itam.security.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
// Контроллер уведомлений отдаёт только уведомления текущего пользователя
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final CurrentUserService currentUserService;

    public NotificationController(NotificationRepository notificationRepository, CurrentUserService currentUserService) {
        this.notificationRepository = notificationRepository;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public Page<NotificationEntity> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        // Список сортируется от новых уведомлений к старым
        return notificationRepository.findByRecipientEmployeeNoOrderByCreatedAtDesc(me, PageRequest.of(page, size));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public NotificationEntity markRead(@PathVariable Long id) {
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        if (id == null) {
            throw new IllegalArgumentException("id is required");
        }
        NotificationEntity n = notificationRepository.findById(id).orElseThrow();
        // Нельзя отметить прочитанным чужое уведомление
        if (!me.equals(n.getRecipientEmployeeNo())) {
            throw new IllegalStateException("Forbidden");
        }
        n.setRead(true);
        return notificationRepository.save(n);
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public ResponseEntity<?> unreadCount() {
        String me = currentUserService.employeeNoOrNull();
        if (me == null) throw new IllegalStateException("Unauthenticated");
        // Лёгкий endpoint для бейджа в боковом меню
        long count = notificationRepository.countByRecipientEmployeeNoAndReadFalse(me);
        return ResponseEntity.ok(Map.of("count", count));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        String me = currentUserService.employeeNoOrNull();
        if (me == null) throw new IllegalStateException("Unauthenticated");
        NotificationEntity n = notificationRepository.findById(id).orElseThrow();
        // Удалять можно только свои уведомления
        if (!me.equals(n.getRecipientEmployeeNo())) throw new IllegalStateException("Forbidden");
        notificationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
