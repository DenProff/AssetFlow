package com.itam.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
// Entity хранит сотрудника, его учётные данные и роль в системе
@Table(name = "employee")
public class EmployeeEntity {
    @Id
    @Column(name = "employee_no", length = 16)
    private String employeeNo;

    @Column(name = "last_name", nullable = false, length = 128)
    private String lastName;

    @Column(name = "first_name", nullable = false, length = 128)
    private String firstName;

    @Column(name = "patronymic", length = 128)
    private String patronymic;

    @Column(name = "position", nullable = false, length = 128)
    private String position;

    @Column(name = "department", nullable = false, length = 128)
    private String department;

    @Column(name = "login", nullable = false, unique = true, length = 64)
    private String login;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "role_id", nullable = false)
    private Long roleId;

    public String getEmployeeNo() {
        return employeeNo;
    }

    public void setEmployeeNo(String employeeNo) {
        this.employeeNo = employeeNo;
    }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getPatronymic() { return patronymic; }
    public void setPatronymic(String patronymic) { this.patronymic = patronymic; }

    public String getFullName() {
        // ФИО собирается из отдельных полей для удобной отдачи на frontend
        return lastName + " " + firstName + (patronymic != null && !patronymic.isBlank() ? " " + patronymic : "");
    }

    public String getPosition() {
        return position;
    }

    public void setPosition(String position) {
        this.position = position;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getLogin() {
        return login;
    }

    public void setLogin(String login) {
        this.login = login;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Long getRoleId() {
        return roleId;
    }

    public void setRoleId(Long roleId) {
        this.roleId = roleId;
    }
}
