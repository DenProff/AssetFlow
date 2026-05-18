package com.itam.service;

import com.itam.persistence.SequenceCounterEntity;
import com.itam.persistence.SequenceCounterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class SequenceService {
    private final SequenceCounterRepository repository;

    public SequenceService(SequenceCounterRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public int nextForYear(String name, int year) {
        SequenceCounterEntity counter = repository.lockByName(name).orElse(null);
        if (counter == null) {
            counter = new SequenceCounterEntity();
            counter.setName(name);
            counter.setYear(year);
            counter.setLastNumber(0);
        } else if (counter.getYear() != year) {
            counter.setYear(year);
            counter.setLastNumber(0);
        }

        counter.setLastNumber(counter.getLastNumber() + 1);
        repository.save(counter);
        return counter.getLastNumber();
    }

    public int currentYear() {
        return LocalDate.now().getYear();
    }
}
