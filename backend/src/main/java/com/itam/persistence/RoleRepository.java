package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface RoleRepository extends JpaRepository<RoleEntity, Long> {
    // Поиск по имени роли используется в security и при рассылке уведомлений ролям
    Optional<RoleEntity> findByName(String name);
}
