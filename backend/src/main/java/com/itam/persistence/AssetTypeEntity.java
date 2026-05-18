package com.itam.persistence;

import jakarta.persistence.*;

@Entity
// Entity хранит тип оборудования и его связь с кодом ОКОФ
@Table(name = "asset_type")
public class AssetTypeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String name;

    @Column(name = "default_useful_life_years", nullable = false)
    private int defaultUsefulLifeYears;

    @ManyToOne(fetch = FetchType.EAGER)
    // Многие типы активов могут ссылаться на один код ОКОФ
    @JoinColumn(name = "okof_code")
    private OkofEntity okof;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public int getDefaultUsefulLifeYears() { return defaultUsefulLifeYears; }
    public void setDefaultUsefulLifeYears(int v) { this.defaultUsefulLifeYears = v; }

    public OkofEntity getOkof() { return okof; }
    public void setOkof(OkofEntity okof) { this.okof = okof; }

    public String getOkofCode() { return okof != null ? okof.getCode() : null; }

    public Integer getAmortizationGroupNo() {
        // Номер амортизационной группы берётся через связанную сущность ОКОФ
        return (okof != null && okof.getAmortizationGroup() != null)
                ? (int) okof.getAmortizationGroup().getGroupNo()
                : null;
    }
}
