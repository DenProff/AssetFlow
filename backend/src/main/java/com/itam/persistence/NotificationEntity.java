package com.itam.persistence;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
// Entity хранит одно уведомление для конкретного сотрудника
@Table(name = "notification")
public class NotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_employee_no", nullable = false, length = 16)
    private String recipientEmployeeNo;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "type", nullable = false, length = 64)
    private String type;

    @Column(name = "title", nullable = false, length = 256)
    private String title;

    @Column(name = "body", nullable = false)
    private String body;

    @Column(name = "related_ticket_no", length = 32)
    private String relatedTicketNo;

    @Column(name = "is_read", nullable = false)
    private boolean read;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRecipientEmployeeNo() {
        return recipientEmployeeNo;
    }

    public void setRecipientEmployeeNo(String recipientEmployeeNo) {
        this.recipientEmployeeNo = recipientEmployeeNo;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getRelatedTicketNo() {
        return relatedTicketNo;
    }

    public void setRelatedTicketNo(String relatedTicketNo) {
        this.relatedTicketNo = relatedTicketNo;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }
}
