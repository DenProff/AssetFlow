package com.itam.api;

import com.itam.persistence.EmployeeEntity;
import com.itam.persistence.EmployeeRepository;
import com.itam.persistence.RoleRepository;
import com.itam.security.JwtService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@RestController
// Все endpoints этого контроллера начинаются с /auth
@RequestMapping("/auth")
public class AuthController {
    private final EmployeeRepository employeeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final long accessTokenTtlMinutes;
    private final long refreshTokenTtlDays;

    public AuthController(
            EmployeeRepository employeeRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${app.jwt.accessTokenTtlMinutes}") long accessTokenTtlMinutes,
            @Value("${app.jwt.refreshTokenTtlDays}") long refreshTokenTtlDays
    ) {
        this.employeeRepository = employeeRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.accessTokenTtlMinutes = accessTokenTtlMinutes;
        this.refreshTokenTtlDays = refreshTokenTtlDays;
    }

    public record LoginRequest(@NotBlank String login, @NotBlank String password) {}

    public record TokenResponse(String accessToken, String refreshToken) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        // Логин ищется в таблице employees, а пароль сравнивается с сохранённым BCrypt-хэшем
        EmployeeEntity employee = employeeRepository.findByLogin(request.login()).orElse(null);
        if (employee == null || !passwordEncoder.matches(request.password(), employee.getPasswordHash())) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid credentials"));
        }

        // В JWT кладётся имя роли, чтобы следующие запросы могли проходить проверки доступа
        String roleName = roleRepository.findById(employee.getRoleId()).map(r -> r.getName()).orElse("EMPLOYEE");

        Instant now = Instant.now();
        // Access token живёт недолго и используется для обычных API-запросов
        String access = jwtService.generateToken(
                employee.getEmployeeNo(),
                now.plus(accessTokenTtlMinutes, ChronoUnit.MINUTES),
                Map.of("role", roleName, "type", "access")
        );
        // Refresh token живёт дольше и нужен только для получения нового access token
        String refresh = jwtService.generateToken(
                employee.getEmployeeNo(),
                now.plus(refreshTokenTtlDays, ChronoUnit.DAYS),
                Map.of("role", roleName, "type", "refresh")
        );

        return ResponseEntity.ok(new TokenResponse(access, refresh));
    }

    public record RefreshRequest(@NotBlank String refreshToken) {}

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody RefreshRequest request) {
        try {
            // Refresh принимает только токен с claim type=refresh
            var claims = jwtService.parse(request.refreshToken());
            if (!"refresh".equals(claims.get("type", String.class))) {
                return ResponseEntity.status(401).body(Map.of("message", "Invalid refresh token"));
            }
            String employeeNo = claims.getSubject();
            // Пользователь должен всё ещё существовать в базе, иначе новый access token не выдаётся
            EmployeeEntity employee = employeeRepository.findById(employeeNo).orElse(null);
            if (employee == null) {
                return ResponseEntity.status(401).body(Map.of("message", "Unknown user"));
            }
            String roleName = roleRepository.findById(employee.getRoleId()).map(r -> r.getName()).orElse("EMPLOYEE");
            Instant now = Instant.now();
            String access = jwtService.generateToken(
                    employeeNo,
                    now.plus(accessTokenTtlMinutes, ChronoUnit.MINUTES),
                    Map.of("role", roleName, "type", "access")
            );
            return ResponseEntity.ok(Map.of("accessToken", access));
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid refresh token"));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        // При stateless JWT logout фактически выполняется на frontend через удаление токенов
        return ResponseEntity.ok(Map.of("message", "ok"));
    }
}
