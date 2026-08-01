package com.fujipp.backend.work.admin;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@Service
public class CloudinaryService {

    private final RestClient restClient;
    private final String cloudName;
    private final String folder;
    private final boolean configured;

    public CloudinaryService(
            @Value("${app.cloudinary.cloud-name:}") String cloudName,
            @Value("${app.cloudinary.api-key:}") String apiKey,
            @Value("${app.cloudinary.api-secret:}") String apiSecret,
            @Value("${app.cloudinary.folder:fujipp/work}") String folder
    ) {
        this.cloudName = cloudName;
        this.folder = folder;
        this.configured = !cloudName.isBlank() && !apiKey.isBlank() && !apiSecret.isBlank();
        this.restClient = RestClient.builder()
                .baseUrl("https://api.cloudinary.com")
                .defaultHeaders(headers -> headers.setBasicAuth(apiKey, apiSecret))
                .build();
    }

    public UploadedMedia upload(MultipartFile file, String projectSlug) {
        return uploadToFolder(file, folder + "/" + projectSlug);
    }

    public UploadedMedia uploadToFolder(MultipartFile file, String targetFolder) {
        requireConfigured();
        try {
            MultipartBodyBuilder body = new MultipartBodyBuilder();
            body.part("file", new NamedByteArrayResource(file.getBytes(), file.getOriginalFilename()))
                    .contentType(MediaType.parseMediaType(file.getContentType()));
            body.part("folder", targetFolder);
            body.part("use_filename", "true");
            body.part("unique_filename", "true");
            body.part("overwrite", "false");

            Map<?, ?> response = restClient.post()
                    .uri("/v1_1/{cloudName}/image/upload", cloudName)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(body.build())
                    .retrieve()
                    .body(Map.class);

            if (response == null
                    || response.get("public_id") == null
                    || response.get("secure_url") == null) {
                throw new CloudinaryException("Cloudinary returned an incomplete upload response", null);
            }
            return new UploadedMedia(
                    response.get("public_id").toString(),
                    response.get("secure_url").toString(),
                    integerValue(response.get("width")),
                    integerValue(response.get("height")),
                    stringValue(response.get("format")),
                    longValue(response.get("bytes"))
            );
        } catch (IOException | RuntimeException exception) {
            if (exception instanceof CloudinaryException cloudinaryException) {
                throw cloudinaryException;
            }
            throw new CloudinaryException("The image could not be uploaded", exception);
        }
    }

    public void delete(String publicId) {
        requireConfigured();
        try {
            MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
            body.add("public_id", publicId);
            body.add("invalidate", "true");

            Map<?, ?> response = restClient.post()
                    .uri("/v1_1/{cloudName}/image/destroy", cloudName)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(body)
                    .retrieve()
                    .body(Map.class);

            Object result = response == null ? null : response.get("result");
            if (!"ok".equals(result) && !"not found".equals(result)) {
                throw new CloudinaryException("Cloudinary did not delete the image", null);
            }
        } catch (RuntimeException exception) {
            if (exception instanceof CloudinaryException cloudinaryException) {
                throw cloudinaryException;
            }
            throw new CloudinaryException("The image could not be deleted", exception);
        }
    }

    private void requireConfigured() {
        if (!configured) {
            throw new CloudinaryException(
                    "Cloudinary credentials are not configured",
                    null
            );
        }
    }

    private Integer integerValue(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    private Long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    public record UploadedMedia(
            String publicId,
            String secureUrl,
            Integer width,
            Integer height,
            String format,
            Long bytes
    ) {
    }

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(byte[] bytes, String filename) {
            super(bytes);
            this.filename = filename == null || filename.isBlank() ? "upload" : filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
