package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TicketRepository extends JpaRepository<TicketEntity, String> {

    // Универсальный поиск заявок с необязательными фильтрами по автору, исполнителю и статусу
    @Query("select t from TicketEntity t where (:authorNo is null or t.authorEmployeeNo = :authorNo) and (:assigneeNo is null or t.assigneeEmployeeNo = :assigneeNo) and (:statusId is null or t.statusId = :statusId)")
    List<TicketEntity> search(@Param("authorNo") String authorNo, @Param("assigneeNo") String assigneeNo, @Param("statusId") Long statusId);

    // Открытые заявки по активу нужны для проверок перед удалением или изменением связанного оборудования
    @Query("select t from TicketEntity t where t.assetInventoryNo = :inventoryNo and t.closedAt is null")
    List<TicketEntity> findOpenByAssetInventoryNo(@Param("inventoryNo") String inventoryNo);

    // Открытые заявки сотрудника нужны для проверок зависимостей перед удалением сотрудника
    @Query("select t from TicketEntity t where (t.authorEmployeeNo = :emp or t.assigneeEmployeeNo = :emp) and t.closedAt is null")
    List<TicketEntity> findOpenByEmployee(@Param("emp") String employeeNo);
}
