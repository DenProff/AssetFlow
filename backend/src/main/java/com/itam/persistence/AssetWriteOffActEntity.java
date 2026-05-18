package com.itam.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
// Entity хранит акт списания ОС-4 и причину вывода актива из эксплуатации
@Table(name = "asset_write_off_act")
public class AssetWriteOffActEntity {

    @Id
    @Column(name = "act_no", length = 32)
    private String actNo;

    @Column(name = "asset_inventory_no", nullable = false, length = 32)
    private String assetInventoryNo;

    @Column(name = "reason", nullable = false, length = 128)
    private String reason;

    @Column(name = "write_off_date", nullable = false)
    private LocalDate writeOffDate;

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

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public LocalDate getWriteOffDate() {
        return writeOffDate;
    }

    public void setWriteOffDate(LocalDate writeOffDate) {
        this.writeOffDate = writeOffDate;
    }
}
