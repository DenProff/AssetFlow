package com.itam.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
// Entity описывает таблицу ticket и хранит состояние одной заявки
@Table(name = "ticket")
public class TicketEntity {

    @Id
    // ticketNo используется как бизнес-ключ и первичный ключ, например T-2026-0001
    @Column(name = "ticket_no", length = 32)
    private String ticketNo;

    @Column(name = "type", nullable = false, length = 128)
    private String type;

    @Column(name = "category", length = 128)
    private String category;

    @Column(name = "author_employee_no", nullable = false, length = 16)
    private String authorEmployeeNo;

    @Column(name = "assignee_employee_no", length = 16)
    private String assigneeEmployeeNo;

    @Column(name = "asset_inventory_no", length = 32)
    private String assetInventoryNo;

    @Column(name = "software_id")
    private Long softwareId;

    @Column(name = "target_software_version", length = 64)
    private String targetSoftwareVersion;

    @Column(name = "justification")
    private String justification;

    @Column(name = "comment")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "status_id", nullable = false)
    private Long statusId;

    public String getTicketNo() {
        return ticketNo;
    }

    public void setTicketNo(String ticketNo) {
        this.ticketNo = ticketNo;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAuthorEmployeeNo() {
        return authorEmployeeNo;
    }

    public void setAuthorEmployeeNo(String authorEmployeeNo) {
        this.authorEmployeeNo = authorEmployeeNo;
    }

    public String getAssigneeEmployeeNo() {
        return assigneeEmployeeNo;
    }

    public void setAssigneeEmployeeNo(String assigneeEmployeeNo) {
        this.assigneeEmployeeNo = assigneeEmployeeNo;
    }

    public String getAssetInventoryNo() {
        return assetInventoryNo;
    }

    public void setAssetInventoryNo(String assetInventoryNo) {
        this.assetInventoryNo = assetInventoryNo;
    }

    public Long getSoftwareId() {
        return softwareId;
    }

    public void setSoftwareId(Long softwareId) {
        this.softwareId = softwareId;
    }

    public String getTargetSoftwareVersion() {
        return targetSoftwareVersion;
    }

    public void setTargetSoftwareVersion(String targetSoftwareVersion) {
        this.targetSoftwareVersion = targetSoftwareVersion;
    }

    public String getJustification() {
        return justification;
    }

    public void setJustification(String justification) {
        this.justification = justification;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(LocalDateTime closedAt) {
        this.closedAt = closedAt;
    }

    public Long getStatusId() {
        return statusId;
    }

    public void setStatusId(Long statusId) {
        this.statusId = statusId;
    }
}
