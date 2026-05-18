package com.itam.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    public String employeeNoOrNull() {
        // JwtAuthFilter кладёт employeeNo в principal текущего Authentication
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof String s) {
            return s;
        }
        return null;
    }

    public String roleOrNull() {
        // Роль берётся из authorities, которые JwtAuthFilter сформировал из claim role
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getAuthorities() == null || auth.getAuthorities().isEmpty()) {
            return null;
        }
        String authority = auth.getAuthorities().iterator().next().getAuthority();
        if (authority != null && authority.startsWith("ROLE_")) {
            return authority.substring("ROLE_".length());
        }
        return authority;
    }
}
