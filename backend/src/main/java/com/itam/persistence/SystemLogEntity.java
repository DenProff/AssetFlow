package com.itam.persistence;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
// Entity хранит одну запись системного журнала
@Table(name = "system_log")
public class SystemLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "logged_at", nullable = false)
    private LocalDateTime loggedAt;

    @Column(name = "actor_employee_no", length = 16)
    private String actorEmployeeNo;

    @Column(name = "action", nullable = false, length = 128)
    private String action;

    @Column(name = "details")
    private String details;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getLoggedAt() {
        return loggedAt;
    }

    public void setLoggedAt(LocalDateTime loggedAt) {
        this.loggedAt = loggedAt;
    }

    public String getActorEmployeeNo() {
        return actorEmployeeNo;
    }

    public void setActorEmployeeNo(String actorEmployeeNo) {
        this.actorEmployeeNo = actorEmployeeNo;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
