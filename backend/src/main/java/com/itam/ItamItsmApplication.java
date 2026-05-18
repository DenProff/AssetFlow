package com.itam;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Главная точка входа backend, с неё Spring Boot начинает запуск приложения
@SpringBootApplication
public class ItamItsmApplication {
    public static void main(String[] args) {
        // Создаёт Spring-контекст, подключает конфигурацию и запускает встроенный HTTP-сервер
        SpringApplication.run(ItamItsmApplication.class, args);
    }
}
