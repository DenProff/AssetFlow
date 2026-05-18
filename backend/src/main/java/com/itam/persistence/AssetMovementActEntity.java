package com.itam.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
// Entity хранит акт ОС-2 как отдельное внутреннее перемещение актива
@Table(name = "asset_movement_act")
public class AssetMovementActEntity {

    @Id
    @Column(name = "act_no", length = 32)
    private String actNo;

    @Column(name = "asset_inventory_no", nullable = false, length = 32)
    private String assetInventoryNo;

    @Column(name = "employee_no", nullable = false, length = 16)
    private String employeeNo;

    @Column(name = "movement_type", nullable = false, length = 16)
    private String movementType;

    @Column(name = "movement_date", nullable = false)
    private LocalDate movementDate;

    @Column(name = "actor_employee_no", length = 16)
    private String actorEmployeeNo;

    @Column(name = "related_act_no", length = 32)
    private String relatedActNo;

    public String getActorEmployeeNo() {
        return actorEmployeeNo;
    }

    public void setActorEmployeeNo(String actorEmployeeNo) {
        this.actorEmployeeNo = actorEmployeeNo;
    }

    public String getActNo() {
        return actNo;
    }

    public void setActNo(String actNo) {
        this.actNo = actNo;
    }

    public String getAssetInventoryNo() {
        return assetInventoryNo;
    }

    public void setAssetInventoryNo(String assetInventoryNo) {
        this.assetInventoryNo = assetInventoryNo;
    }

    public String getEmployeeNo() {
        return employeeNo;
    }

    public void setEmployeeNo(String employeeNo) {
        this.employeeNo = employeeNo;
    }

    public String getMovementType() {
        return movementType;
    }

    public void setMovementType(String movementType) {
        this.movementType = movementType;
    }

    public LocalDate getMovementDate() {
        return movementDate;
    }

    public void setMovementDate(LocalDate movementDate) {
        this.movementDate = movementDate;
    }

    public String getRelatedActNo() {
        return relatedActNo;
    }

    public void setRelatedActNo(String relatedActNo) {
        this.relatedActNo = relatedActNo;
    }
}
