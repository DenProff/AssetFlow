package com.itam.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Map;

@Service
// Сервис создаёт и проверяет JWT access и refresh токены
public class JwtService {
    // Секретный ключ подписывает токены и позволяет проверить, что их не изменили
    private final SecretKey key;
    private final String issuer;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.issuer}") String issuer
    ) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 characters");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
    }

    public String generateToken(String subject, Instant expiresAt, Map<String, Object> claims) {
        // Subject хранит employeeNo, claims дополняют токен ролью и другими данными
        return Jwts.builder()
                .issuer(issuer)
                .subject(subject)
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(expiresAt))
                .claims(claims)
                .signWith(key)
                .compact();
    }

    public Claims parse(String token) {
        // Проверяет подпись, issuer и срок действия, затем возвращает payload токена
        return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(issuer)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
