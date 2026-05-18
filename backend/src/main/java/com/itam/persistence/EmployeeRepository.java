package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<EmployeeEntity, String> {
    // Логин используется при аутентификации и должен быть уникальным
    Optional<EmployeeEntity> findByLogin(String login);

    // Поиск сотрудников по роли нужен для уведомлений и выборок IT-персонала
    List<EmployeeEntity> findByRoleIdOrderByEmployeeNo(Long roleId);
}
