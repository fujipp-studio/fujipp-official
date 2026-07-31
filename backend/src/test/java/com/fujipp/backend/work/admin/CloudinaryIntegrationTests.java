package com.fujipp.backend.work.admin;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(
        named = "CLOUDINARY_INTEGRATION_TESTS",
        matches = "true"
)
class CloudinaryIntegrationTests {

    private static final byte[] ONE_PIXEL_PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
                    + "YAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    );

    @Test
    void uploadsAndDeletesImage() {
        CloudinaryService cloudinaryService = new CloudinaryService(
                requireEnvironment("CLOUDINARY_CLOUD_NAME"),
                requireEnvironment("CLOUDINARY_API_KEY"),
                requireEnvironment("CLOUDINARY_API_SECRET"),
                System.getenv().getOrDefault(
                        "CLOUDINARY_FOLDER",
                        "fujipp/work"
                ) + "/integration-tests"
        );
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "one-pixel.png",
                "image/png",
                ONE_PIXEL_PNG
        );

        CloudinaryService.UploadedMedia uploaded = cloudinaryService.upload(
                file,
                "cloudinary-integration"
        );
        try {
            assertThat(uploaded.publicId()).isNotBlank();
            assertThat(uploaded.secureUrl()).startsWith("https://");
            assertThat(uploaded.format()).isEqualTo("png");
        } finally {
            cloudinaryService.delete(uploaded.publicId());
        }
    }

    private String requireEnvironment(String name) {
        String value = System.getenv(name);
        assertThat(value)
                .as("%s must be exported for the Cloudinary integration test", name)
                .isNotBlank();
        return value;
    }
}
