package com.itam.persistence;

import jakarta.persistence.*;

@Entity
// Entity хранит амортизационную группу и диапазон срока полезного использования
@Table(name = "amortization_group")
public class AmortizationGroupEntity {

    @Id
    @Column(name = "group_no")
    private Short groupNo;

    @Column(nullable = false, length = 200)
    private String description;

    @Column(name = "min_useful_life_months", nullable = false)
    private int minUsefulLifeMonths;

    @Column(name = "max_useful_life_months")
    private Integer maxUsefulLifeMonths;

    public Short getGroupNo() { return groupNo; }
    public void setGroupNo(Short groupNo) { this.groupNo = groupNo; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getMinUsefulLifeMonths() { return minUsefulLifeMonths; }
    public void setMinUsefulLifeMonths(int minUsefulLifeMonths) { this.minUsefulLifeMonths = minUsefulLifeMonths; }

    public Integer getMaxUsefulLifeMonths() { return maxUsefulLifeMonths; }
    public void setMaxUsefulLifeMonths(Integer maxUsefulLifeMonths) { this.maxUsefulLifeMonths = maxUsefulLifeMonths; }
}
