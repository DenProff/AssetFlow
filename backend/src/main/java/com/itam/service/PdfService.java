package com.itam.service;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

@Service
// Сервис конвертирует заполненные Excel-акты в PDF
public class PdfService {

    private static final String[] FONT_CANDIDATES = {
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/times.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    };

    private static final String[] LIBREOFFICE_CANDIDATES = {
        "C:/Program Files/LibreOffice/program/soffice.exe",
        "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
        "/usr/bin/libreoffice",
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
    };

    public byte[] excelToPdf(byte[] excelBytes, String extension, String fallbackHtml) {
        String loExe = null;
        for (String c : LIBREOFFICE_CANDIDATES) {
            if (new File(c).exists()) { loExe = c; break; }
        }
        if (loExe == null) {
            // Если LibreOffice не установлен, PDF строится из упрощённого HTML
            return renderHtmlToPdf(fallbackHtml);
        }
        return convertWithLibreOffice(excelBytes, extension, loExe);
    }

    private byte[] convertWithLibreOffice(byte[] excelBytes, String extension, String loExe) {
        Path tmpDir = null;
        try {
            tmpDir = Files.createTempDirectory("assetflow-xls2pdf-");
            Path xlsFile = tmpDir.resolve("document." + extension);
            Files.write(xlsFile, excelBytes);
            // LibreOffice запускается в headless-режиме и конвертирует временный Excel в PDF
            ProcessBuilder pb = new ProcessBuilder(
                loExe, "--headless", "--convert-to", "pdf",
                "--outdir", tmpDir.toString(), xlsFile.toString()
            );
            pb.redirectErrorStream(true);
            Process p = pb.start();
            int exit = p.waitFor();
            if (exit != 0) {
                throw new IllegalStateException("LibreOffice exited with code " + exit);
            }
            return Files.readAllBytes(tmpDir.resolve("document.pdf"));
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Excel to PDF conversion failed: " + e.getMessage(), e);
        } finally {
            if (tmpDir != null) {
                try {
                    Files.walk(tmpDir)
                         .sorted(Comparator.reverseOrder())
                         .forEach(path -> { try { Files.delete(path); } catch (IOException ignored) {} });
                } catch (IOException ignored) {}
            }
        }
    }

    public byte[] renderHtmlToPdf(String html) {
        try {
            // openhtmltopdf требует XHTML, поэтому одиночные HTML-теги закрываются явно
            String xhtml = html
                    .replaceAll("(?i)<meta([^/]*?)>", "<meta$1 />")
                    .replaceAll("(?i)<br([^/]*?)>",   "<br$1 />")
                    .replaceAll("(?i)<hr([^/]*?)>",   "<hr$1 />")
                    .replaceAll("(?i)<img([^/]*?)>",  "<img$1 />");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            PdfRendererBuilder builder = new PdfRendererBuilder();
            // Первый найденный шрифт регистрируется для корректной кириллицы в PDF
            for (String path : FONT_CANDIDATES) {
                File f = new File(path);
                if (f.exists()) {
                    builder.useFont(f, "DocFont");
                    // CSS принудительно применяет шрифт ко всем элементам документа
                    String inject = "<style>*{font-family:'DocFont',sans-serif!important}</style>";
                    xhtml = xhtml.replace("</head>", inject + "</head>");
                    break;
                }
            }
            builder.withHtmlContent(xhtml, null);
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to render PDF", e);
        }
    }
}
