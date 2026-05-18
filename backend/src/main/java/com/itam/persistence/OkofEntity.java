package com.itam.persistence;

import jakarta.persistence.*;

@Entity
// Entity хранит код ОКОФ и связанную амортизационную группу
@Table(name = "okof")
public class OkofEntity {

    @Id
    @Column(length = 32)
    private String code;

    @Column(nullable = false, length = 256)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    // Многие коды ОКОФ относятся к одной амортизационной группе
    @JoinColumn(name = "amortization_group_no")
    private AmortizationGroupEntity amortizationGroup;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public AmortizationGroupEntity getAmortizationGroup() { return amortizationGroup; }
    public void setAmortizationGroup(AmortizationGroupEntity amortizationGroup) { this.amortizationGroup = amortizationGroup; }
}
