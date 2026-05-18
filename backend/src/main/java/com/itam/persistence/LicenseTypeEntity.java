package com.itam.persistence;

import jakarta.persistence.*;

@Entity
// Entity хранит справочник типов лицензий ПО
@Table(name = "license_type")
public class LicenseTypeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String name;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
}
