package com.itam.api;

import com.itam.persistence.*;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
// Контроллер аналитики собирает агрегированную сводку из нескольких модулей
@RequestMapping("/analytics")
public class AnalyticsController {

    private static final String[] RU_MONTHS =
        {"Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"};

    record NameCount(String name, long count) {}
    record MonthBar(String month, long issues, long returns, long writeoffs) {}
    record AssetStats(long total, List<NameCount> byStatus, List<NameCount> byType, BigDecimal totalCost) {}
    record TicketStats(List<NameCount> byStatus) {}
    record SoftwareStats(long active, long expiringSoon, long expired) {}
    record Summary(AssetStats assets, List<MonthBar> dynamics, TicketStats tickets, SoftwareStats software) {}

    private final AssetRepository assetRepo;
    private final AssetStatusRepository statusRepo;
    private final AssetTypeRepository typeRepo;
    private final AssetMovementActRepository movementRepo;
    private final AssetWriteOffActRepository writeoffRepo;
    private final TicketRepository ticketRepo;
    private final TicketStatusRepository ticketStatusRepo;
    private final SoftwareRepository softwareRepo;

    public AnalyticsController(AssetRepository assetRepo,
                               AssetStatusRepository statusRepo,
                               AssetTypeRepository typeRepo,
                               AssetMovementActRepository movementRepo,
                               AssetWriteOffActRepository writeoffRepo,
                               TicketRepository ticketRepo,
                               TicketStatusRepository ticketStatusRepo,
                               SoftwareRepository softwareRepo) {
        this.assetRepo = assetRepo;
        this.statusRepo = statusRepo;
        this.typeRepo = typeRepo;
        this.movementRepo = movementRepo;
        this.writeoffRepo = writeoffRepo;
        this.ticketRepo = ticketRepo;
        this.ticketStatusRepo = ticketStatusRepo;
        this.softwareRepo = softwareRepo;
    }

    @GetMapping("/summary")
    public Summary summary() {
        // Активы загружаются целиком, дальше статистика считается в памяти
        List<AssetEntity> allAssets = assetRepo.findAll();

        // Справочники превращаются в map, чтобы заменить id на понятные названия
        Map<Long, String> statusMap = statusRepo.findAll().stream()
                .collect(Collectors.toMap(AssetStatusEntity::getId, AssetStatusEntity::getName));
        Map<Long, String> typeMap = typeRepo.findAll().stream()
                .collect(Collectors.toMap(AssetTypeEntity::getId, AssetTypeEntity::getName));

        List<NameCount> byStatus = allAssets.stream()
                // Группируем активы по названию статуса
                .collect(Collectors.groupingBy(
                        a -> statusMap.getOrDefault(a.getStatusId(), "Прочее"),
                        Collectors.counting()))
                .entrySet().stream()
                .map(e -> new NameCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(NameCount::count).reversed())
                .toList();

        List<NameCount> byType = allAssets.stream()
                // Группируем активы по названию типа оборудования
                .collect(Collectors.groupingBy(
                        a -> typeMap.getOrDefault(a.getTypeId(), "Прочее"),
                        Collectors.counting()))
                .entrySet().stream()
                .map(e -> new NameCount(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(NameCount::count).reversed())
                .toList();

        BigDecimal totalCost = allAssets.stream()
                // Общая стоимость парка считается суммой стоимости всех активов
                .map(AssetEntity::getCost)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        AssetStats assetStats = new AssetStats(allAssets.size(), byStatus, byType, totalCost);

        // Динамика строится за последние 6 месяцев по актам выдачи и списания
        LocalDate from = LocalDate.now().minusMonths(5).withDayOfMonth(1);
        List<AssetMovementActEntity> recentIssues = movementRepo.findByMovementTypeAndMovementDateAfter("ISSUE", from.minusDays(1));
        List<AssetMovementActEntity> recentReturns = movementRepo.findByMovementTypeAndMovementDateAfter("RETURN", from.minusDays(1));
        List<AssetWriteOffActEntity> recentWriteoffs = writeoffRepo.findByWriteOffDateAfter(from.minusDays(1));

        List<MonthBar> dynamics = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            // Для каждого месяца считаем количество выдач и списаний
            LocalDate m = LocalDate.now().minusMonths(i).withDayOfMonth(1);
            int mv = m.getMonthValue(), yr = m.getYear();
            long issues = recentIssues.stream().filter(
                    a -> a.getMovementDate().getMonthValue() == mv && a.getMovementDate().getYear() == yr).count();
            long returns = recentReturns.stream().filter(
                    a -> a.getMovementDate().getMonthValue() == mv && a.getMovementDate().getYear() == yr).count();
            long wo = recentWriteoffs.stream().filter(
                    a -> a.getWriteOffDate().getMonthValue() == mv && a.getWriteOffDate().getYear() == yr).count();
            dynamics.add(new MonthBar(RU_MONTHS[mv - 1], issues, returns, wo));
        }

        // Заявки группируются по названию статуса
        Map<Long, String> tsMap = ticketStatusRepo.findAll().stream()
                .collect(Collectors.toMap(TicketStatusEntity::getId, TicketStatusEntity::getName));
        List<NameCount> ticketsByStatus = ticketRepo.findAll().stream()
                .collect(Collectors.groupingBy(
                        t -> tsMap.getOrDefault(t.getStatusId(), "Прочее"),
                        Collectors.counting()))
                .entrySet().stream()
                .map(e -> new NameCount(e.getKey(), e.getValue()))
                .toList();

        // Статистика ПО показывает состояние лицензий
        List<SoftwareEntity> allSw = softwareRepo.findAll();
        LocalDate today    = LocalDate.now();
        LocalDate in30Days = today.plusDays(30);

        long swActive = allSw.stream()
                .filter(s -> s.getLicenseEnd() == null || !s.getLicenseEnd().isBefore(in30Days)).count();
        long expiringSoon = allSw.stream()
                .filter(s -> s.getLicenseEnd() != null
                        && !s.getLicenseEnd().isBefore(today)
                        && s.getLicenseEnd().isBefore(in30Days)).count();
        long swExpired = allSw.stream()
                .filter(s -> s.getLicenseEnd() != null && s.getLicenseEnd().isBefore(today)).count();

        return new Summary(assetStats, dynamics, new TicketStats(ticketsByStatus),
                new SoftwareStats(swActive, expiringSoon, swExpired));
    }
}
