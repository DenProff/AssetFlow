package com.itam.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AssetMovementActRepository extends JpaRepository<AssetMovementActEntity, String> {

    // Открытый акт выдачи показывает, что актив сейчас находится у сотрудника
    @Query("""
            select issue from AssetMovementActEntity issue
            where issue.assetInventoryNo = :assetInventoryNo
              and issue.movementType = 'ISSUE'
              and not exists (
                  select ret from AssetMovementActEntity ret
                  where ret.movementType = 'RETURN'
                    and ret.relatedActNo = issue.actNo
              )
            order by issue.movementDate desc
            """)
    List<AssetMovementActEntity> findOpenIssuesByAssetInventoryNo(@Param("assetInventoryNo") String assetInventoryNo);

    // Используется для получения активов, которые сейчас числятся за сотрудником
    @Query("""
            select issue from AssetMovementActEntity issue
            where issue.employeeNo = :employeeNo
              and issue.movementType = 'ISSUE'
              and not exists (
                  select ret from AssetMovementActEntity ret
                  where ret.movementType = 'RETURN'
                    and ret.relatedActNo = issue.actNo
              )
            order by issue.movementDate desc
            """)
    List<AssetMovementActEntity> findOpenIssuesByEmployeeNo(@Param("employeeNo") String employeeNo);

    // Используется в аналитике для подсчёта недавних выдач
    List<AssetMovementActEntity> findByMovementTypeAndMovementDateAfter(String movementType, java.time.LocalDate date);
}
