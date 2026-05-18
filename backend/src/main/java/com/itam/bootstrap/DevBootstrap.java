package com.itam.bootstrap;

import com.itam.persistence.EmployeeEntity;
import com.itam.persistence.EmployeeRepository;
import com.itam.persistence.RoleRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DevBootstrap implements CommandLineRunner {
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public DevBootstrap(EmployeeRepository employeeRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder) {
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        Long itSpecialistId = roleRepository.findByName("IT_SPECIALIST").orElseThrow().getId();
        Long itManagerId    = roleRepository.findByName("IT_MANAGER").orElseThrow().getId();
        Long empRoleId      = roleRepository.findByName("EMPLOYEE").orElseThrow().getId();
        Long hrRoleId       = roleRepository.findByName("HR").orElseThrow().getId();

        createIfAbsent("000001", "Иванов",   "Алексей",    "Сергеевич", "ИТ-специалист",     "ИТ-отдел",    "admin",   "admin",   itSpecialistId);
        createIfAbsent("000002", "Петров",   "Иван",       "Иванович",  "Инженер",            "Производство", "user",    "user",    empRoleId);
        createIfAbsent("000003", "Смирнова", "Екатерина",  "Олеговна",  "Руководитель ИТ",   "ИТ-отдел",    "manager", "manager", itManagerId);
        createIfAbsent("000004", "Козлова",  "Мария",      "Андреевна", "Специалист по кадрам","Отдел кадров", "hr",      "hr",      hrRoleId);
    }

    private void createIfAbsent(String employeeNo, String lastName, String firstName, String patronymic,
                                String position, String department, String login, String password, Long roleId) {
        if (employeeRepository.findByLogin(login).isPresent()) {
            return;
        }
        EmployeeEntity e = new EmployeeEntity();
        e.setEmployeeNo(employeeNo);
        e.setLastName(lastName);
        e.setFirstName(firstName);
        e.setPatronymic(patronymic);
        e.setPosition(position);
        e.setDepartment(department);
        e.setLogin(login);
        e.setPasswordHash(passwordEncoder.encode(password));
        e.setRoleId(roleId);
        employeeRepository.save(e);
    }
}
