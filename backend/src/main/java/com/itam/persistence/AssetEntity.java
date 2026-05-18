package com.itam.persistence;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
// Entity описывает таблицу asset и хранит карточку одного оборудования
@Table(name = "asset")
public class AssetEntity {

    @Id
    @Column(name = "inventory_no", length = 32)
    private String inventoryNo;

    @Column(name = "type_id", nullable = false)
    private Long typeId;

    @Column(nullable = false, length = 128)
    private String manufacturer;

    @Column(nullable = false, length = 256)
    private String model;

    @Column(name = "serial_number", nullable = false, unique = true, length = 128)
    private String serialNumber;

    @Column(name = "purchase_date", nullable = false)
    private LocalDate purchaseDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cost;

    @Column(name = "status_id", nullable = false)
    private Long statusId;

    @Column(name = "vendor_name", length = 256)
    private String vendorName;

    @Column(name = "receipt_act_no", length = 32)
    private String receiptActNo;

    public String getInventoryNo() {
        return inventoryNo;
    }

    public void setInventoryNo(String inventoryNo) {
        this.inventoryNo = inventoryNo;
    }

    public Long getTypeId() {
        return typeId;
    }

    public void setTypeId(Long typeId) {
        this.typeId = typeId;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public void setManufacturer(String manufacturer) {
        this.manufacturer = manufacturer;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public void setSerialNumber(String serialNumber) {
        this.serialNumber = serialNumber;
    }

    public LocalDate getPurchaseDate() {
        return purchaseDate;
    }

    public void setPurchaseDate(LocalDate purchaseDate) {
        this.purchaseDate = purchaseDate;
    }

    public BigDecimal getCost() {
        return cost;
    }

    public void setCost(BigDecimal cost) {
        this.cost = cost;
    }

    public Long getStatusId() {
        return statusId;
    }

    public void setStatusId(Long statusId) {
        this.statusId = statusId;
    }

    public String getVendorName() {
        return vendorName;
    }

    public void setVendorName(String vendorName) {
        this.vendorName = vendorName;
    }

    public String getReceiptActNo() {
        return receiptActNo;
    }

    public void setReceiptActNo(String receiptActNo) {
        this.receiptActNo = receiptActNo;
    }
}
