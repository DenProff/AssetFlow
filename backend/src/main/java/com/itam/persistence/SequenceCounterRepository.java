package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.Optional;

public interface SequenceCounterRepository extends JpaRepository<SequenceCounterEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from SequenceCounterEntity c where c.name = :name")
    Optional<SequenceCounterEntity> lockByName(@Param("name") String name);
}
