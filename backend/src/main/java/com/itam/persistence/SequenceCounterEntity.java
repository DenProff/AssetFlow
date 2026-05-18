package com.itam.persistence;

import jakarta.persistence.*;

@Entity
@Table(name = "sequence_counter")
public class SequenceCounterEntity {

    @Id
    @Column(name = "name", length = 64)
    private String name;

    @Column(name = "year", nullable = false)
    private int year;

    @Column(name = "last_number", nullable = false)
    private int lastNumber;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getYear() {
        return year;
    }

    public void setYear(int year) {
        this.year = year;
    }

    public int getLastNumber() {
        return lastNumber;
    }

    public void setLastNumber(int lastNumber) {
        this.lastNumber = lastNumber;
    }
}
