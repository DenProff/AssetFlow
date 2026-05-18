package com.itam.api;

import com.itam.persistence.TicketEntity;
import com.itam.persistence.TicketRepository;
import com.itam.security.CurrentUserService;
import com.itam.service.TicketService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
// Контроллер принимает HTTP-запросы по заявкам, а бизнес-правила делегирует TicketService
@RequestMapping("/tickets")
public class TicketController {

    private final TicketRepository ticketRepository;
    private final TicketService ticketService;
    private final CurrentUserService currentUserService;

    public TicketController(TicketRepository ticketRepository, TicketService ticketService, CurrentUserService currentUserService) {
        this.ticketRepository = ticketRepository;
        this.ticketService = ticketService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<TicketEntity> list(@RequestParam(required = false) Long statusId) {
        String role = currentUserService.roleOrNull();
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }

        // Обычный сотрудник видит только свои заявки, IT и HR видят общий список
        if ("EMPLOYEE".equals(role)) {
            return ticketRepository.search(me, null, statusId);
        }

        if ("IT_SPECIALIST".equals(role) || "IT_MANAGER".equals(role)) {
            return ticketRepository.search(null, null, statusId);
        }

        if ("HR".equals(role)) {
            return ticketRepository.search(null, null, statusId);
        }

        return ticketRepository.search(me, null, statusId);
    }

    public record CreateTicketRequest(
            @NotBlank String type,
            String category,
            String assetInventoryNo,
            Long softwareId,
            String targetSoftwareVersion,
            String justification
    ) {}

    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER')")
    public TicketEntity create(@RequestBody @Valid CreateTicketRequest request) {
        // Автор заявки всегда берётся из JWT, а не из тела запроса
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return ticketService.create(new TicketService.CreateTicketCommand(
                request.type(),
                request.category(),
                me,
                request.assetInventoryNo(),
                request.softwareId(),
                request.targetSoftwareVersion(),
                request.justification()
        ));
    }

    @PostMapping("/{ticketNo}/assign-to-me")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public TicketEntity assignToMe(@PathVariable String ticketNo) {
        // Исполнитель также берётся из JWT, чтобы нельзя было назначить заявку от чужого имени
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return ticketService.assignToMe(ticketNo, me);
    }

    public record ChangeStatusRequest(@NotBlank String statusName, String comment, Boolean keepInRepair) {}

    @PostMapping("/{ticketNo}/status")
    @PreAuthorize("hasAnyRole('IT_SPECIALIST','IT_MANAGER')")
    public TicketEntity changeStatus(@PathVariable String ticketNo, @RequestBody @Valid ChangeStatusRequest request) {
        String me = currentUserService.employeeNoOrNull();
        if (me == null) {
            throw new IllegalStateException("Unauthenticated");
        }
        return ticketService.changeStatus(ticketNo, request.statusName(), request.comment(), me, Boolean.TRUE.equals(request.keepInRepair()));
    }
}
