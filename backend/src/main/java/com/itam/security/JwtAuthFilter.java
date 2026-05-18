package com.itam.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
// Фильтр выполняется один раз на запрос и пытается авторизовать пользователя по JWT
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        // Frontend передаёт JWT в заголовке Authorization: Bearer <token>
        String auth = request.getHeader("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = auth.substring("Bearer ".length());
        try {
            // Если подпись, issuer или срок действия неверные, parse выбросит исключение
            Claims claims = jwtService.parse(token);
            String subject = claims.getSubject();
            String role = claims.get("role", String.class);
            if (subject != null && role != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                // Spring Security ожидает роли в формате ROLE_*, поэтому роль из токена дополняется префиксом
                var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
                var authentication = new UsernamePasswordAuthenticationToken(subject, null, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                // После установки Authentication текущий запрос считается авторизованным
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception ignored) {
            // Невалидный токен не авторизует запрос, дальше доступ решит SecurityConfig
        }

        filterChain.doFilter(request, response);
    }
}
