package com.itam.api;

import com.itam.persistence.*;
import com.itam.service.AuditService;
import com.itam.security.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@RestController
// Контроллер сотрудников управляет кадровыми данными и учётными записями
@RequestMapping("/employees")
public class EmployeeController {

    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final AssetMovementActRepository assetMovementActRepository;
    private final TicketRepository ticketRepository;

    public EmployeeController(
            EmployeeRepository employeeRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService,
            CurrentUserService currentUserService,
            AssetMovementActRepository assetMovementActRepository,
            TicketRepository ticketRepository
    ) {
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.currentUserService = currentUserService;
        this.assetMovementActRepository = assetMovementActRepository;
        this.ticketRepository = ticketRepository;
    }

    public record EmployeeDto(
            String employeeNo,
            String lastName,
            String firstName,
            String patronymic,
            String fullName,
            String position,
            String department,
            String login,
            Long roleId
    ) {
        public static EmployeeDto from(EmployeeEntity e) {
            // DTO не отдаёт passwordHash на frontend
            return new EmployeeDto(
                    e.getEmployeeNo(),
                    e.getLastName(),
                    e.getFirstName(),
                    e.getPatronymic(),
                    e.getFullName(),
                    e.getPosition(),
                    e.getDepartment(),
                    e.getLogin(),
                    e.getRoleId()
            );
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public List<EmployeeDto> list() {
        return employeeRepository.findAll().stream().map(EmployeeDto::from).toList();
    }

    @GetMapping("/{employeeNo}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','IT_SPECIALIST','IT_MANAGER','HR')")
    public EmployeeDto get(@PathVariable String employeeNo) {
        return employeeRepository.findById(employeeNo)
                .map(EmployeeDto::from)
                .orElseThrow(() -> new IllegalArgumentException("employee not found: " + employeeNo));
    }

    public record CreateEmployeeRequest(
            @NotBlank String lastName,
            @NotBlank String firstName,
            String patronymic,
            @NotBlank String position,
            @NotBlank String department,
            @NotBlank String login,
            @NotBlank String password,
            @NotNull Long roleId
    ) {}

    private String generateEmployeeNo() {
        // Новый табельный номер строится как следующий номер после максимального существующего
        int max = employeeRepository.findAll().stream()
                .mapToInt(e -> { try { return Integer.parseInt(e.getEmployeeNo().trim()); } catch (NumberFormatException ex) { return 0; } })
                .max().orElse(0);
        return String.format("%06d", max + 1);
    }

    @PostMapping
    @Transactional
    @PreAuthorize("hasAnyRole('IT_MANAGER','HR')")
    public EmployeeDto create(@RequestBody @Valid CreateEmployeeRequest request) {
        // Логин должен быть уникальным, потому что используется для входа в систему
        if (employeeRepository.findByLogin(request.login()).isPresent()) {
            throw new IllegalArgumentException("login already taken");
        }
        roleRepository.findById(request.roleId())
                .orElseThrow(() -> new IllegalArgumentException("role not found: " + request.roleId()));

        String employeeNo = generateEmployeeNo();
        EmployeeEntity e = new EmployeeEntity();
        // Пароль хранится только в виде hash, исходный пароль в БД не сохраняется
        e.setEmployeeNo(employeeNo);
        e.setLastName(request.lastName());
        e.setFirstName(request.firstName());
        e.setPatronymic(request.patronymic());
        e.setPosition(request.position());
        e.setDepartment(request.department());
        e.setLogin(request.login());
        e.setPasswordHash(passwordEncoder.encode(request.password()));
        e.setRoleId(request.roleId());

        EmployeeDto saved = EmployeeDto.from(employeeRepository.save(e));
        String actor = currentUserService.employeeNoOrNull();
        auditService.log(actor, "EMPLOYEE_CREATED", "employeeNo=" + saved.employeeNo() + "; login=" + saved.login());
        return saved;
    }

    public record UpdateEmployeeRequest(
            @NotBlank String lastName,
            @NotBlank String firstName,
            String patronymic,
            @NotBlank String position,
            @NotBlank String department,
            @NotBlank String login,
            String password,
            @NotNull Long roleId
    ) {}

    @PutMapping("/{employeeNo}")
    @Transactional
    @PreAuthorize("hasAnyRole('IT_MANAGER','HR')")
    public EmployeeDto update(@PathVariable String employeeNo, @RequestBody @Valid UpdateEmployeeRequest req) {
        EmployeeEntity e = employeeRepository.findById(employeeNo)
                .orElseThrow(() -> new IllegalArgumentException("employee not found: " + employeeNo));
        // Нельзя занять логин другого сотрудника
        if (!e.getLogin().equals(req.login()) && employeeRepository.findByLogin(req.login()).isPresent()) {
            throw new IllegalArgumentException("login already taken");
        }
        roleRepository.findById(req.roleId())
                .orElseThrow(() -> new IllegalArgumentException("role not found: " + req.roleId()));

        List<String> changes = new ArrayList<>();
        // В audit log попадают только реально изменённые поля
        if (!Objects.equals(e.getLastName(),   req.lastName()))   changes.add("lastName: "   + e.getLastName()   + "→" + req.lastName());
        if (!Objects.equals(e.getFirstName(),  req.firstName()))  changes.add("firstName: "  + e.getFirstName()  + "→" + req.firstName());
        if (!Objects.equals(e.getPatronymic(), req.patronymic())) changes.add("patronymic: " + e.getPatronymic() + "→" + req.patronymic());
        if (!Objects.equals(e.getPosition(),   req.position()))   changes.add("position: "   + e.getPosition()   + "→" + req.position());
        if (!Objects.equals(e.getDepartment(), req.department())) changes.add("department: " + e.getDepartment() + "→" + req.department());
        if (!Objects.equals(e.getLogin(),      req.login()))      changes.add("login: "      + e.getLogin()      + "→" + req.login());
        if (!Objects.equals(e.getRoleId(),     req.roleId()))     changes.add("roleId: "     + e.getRoleId()     + "→" + req.roleId());
        boolean pwChanged = req.password() != null && !req.password().isBlank();
        if (pwChanged) changes.add("password: changed");

        e.setLastName(req.lastName()); e.setFirstName(req.firstName()); e.setPatronymic(req.patronymic());
        e.setPosition(req.position()); e.setDepartment(req.department()); e.setLogin(req.login());
        e.setRoleId(req.roleId());
        if (pwChanged) e.setPasswordHash(passwordEncoder.encode(req.password()));

        EmployeeDto saved = EmployeeDto.from(employeeRepository.save(e));
        if (!changes.isEmpty()) {
            String actor = currentUserService.employeeNoOrNull();
            auditService.log(actor, "EMPLOYEE_UPDATED", "employeeNo=" + employeeNo + "; " + String.join("; ", changes));
        }
        return saved;
    }

    @DeleteMapping("/{employeeNo}")
    @Transactional
    @PreAuthorize("hasAnyRole('IT_MANAGER','HR')")
    public ResponseEntity<Void> delete(@PathVariable String employeeNo) {
        String actor = currentUserService.employeeNoOrNull();
        // Пользователь не может удалить сам себя
        if (employeeNo.equals(actor)) {
            throw new IllegalStateException("Нельзя удалить свою учётную запись");
        }
        employeeRepository.findById(employeeNo)
                .orElseThrow(() -> new IllegalArgumentException("employee not found: " + employeeNo));
        List<AssetMovementActEntity> openActs = assetMovementActRepository.findOpenIssuesByEmployeeNo(employeeNo);
        if (!openActs.isEmpty()) {
            throw new IllegalStateException("Нельзя удалить: за сотрудником числится оборудование (" + openActs.size() + " шт.)");
        }
        // Открытые заявки должны быть закрыты или переназначены до удаления сотрудника
        List<TicketEntity> openTickets = ticketRepository.findOpenByEmployee(employeeNo);
        if (!openTickets.isEmpty()) {
            throw new IllegalStateException("Нельзя удалить: есть открытые заявки (" + openTickets.size() + " шт.)");
        }
        employeeRepository.deleteById(employeeNo);
        auditService.log(actor, "EMPLOYEE_DELETED", "employeeNo=" + employeeNo);
        return ResponseEntity.noContent().build();
    }
}
