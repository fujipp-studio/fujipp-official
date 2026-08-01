package com.fujipp.backend.store;

import com.fujipp.backend.work.admin.CloudinaryService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminFeatureServiceTests {

    private final StoreRepository repository = mock(StoreRepository.class);
    private final CloudinaryService cloudinaryService = mock(CloudinaryService.class);
    private final AdminFeatureService service = new AdminFeatureService(
            repository,
            cloudinaryService,
            "fujipp/features",
            1024 * 1024
    );

    @Test
    void rejectsNonYoutubeTutorialLinks() {
        UUID featureId = UUID.randomUUID();
        when(repository.findFeatureAdminMedia(featureId))
                .thenReturn(Optional.of(feature("welcome", null)));

        assertThatThrownBy(() -> service.updateTutorial(
                featureId,
                new UpdateFeatureTutorialRequest("https://example.com/tutorial")
        )).isInstanceOf(StoreValidationException.class);

        verify(repository, never()).updateTutorialUrl(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    @Test
    void acceptsYoutubeWatchAndShortLinks() {
        UUID featureId = UUID.randomUUID();
        StoreRepository.FeatureAdminMedia before = feature("welcome", null);
        StoreRepository.FeatureAdminMedia after = new StoreRepository.FeatureAdminMedia(
                "welcome", null, null, null, null, null, null, null,
                "https://youtu.be/abcdefghijk"
        );
        when(repository.findFeatureAdminMedia(featureId))
                .thenReturn(Optional.of(before), Optional.of(after));
        when(repository.updateTutorialUrl(
                featureId,
                "https://youtu.be/abcdefghijk"
        )).thenReturn(true);

        FeatureMediaResponse response = service.updateTutorial(
                featureId,
                new UpdateFeatureTutorialRequest("https://youtu.be/abcdefghijk")
        );

        assertThat(response.tutorialUrl()).isEqualTo("https://youtu.be/abcdefghijk");
    }

    @Test
    void uploadsImageAndDeletesPreviousCloudinaryAsset() {
        UUID featureId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile(
                "file", "feature.png", "image/png", new byte[]{1, 2, 3}
        );
        StoreRepository.FeatureAdminMedia before = feature("welcome", "old/public-id");
        StoreRepository.FeatureAdminMedia after = new StoreRepository.FeatureAdminMedia(
                "welcome", "new/public-id", "https://cdn.example/new.png",
                800, 600, "png", 3L, "Welcome feature", null
        );
        CloudinaryService.UploadedMedia uploaded = new CloudinaryService.UploadedMedia(
                "new/public-id", "https://cdn.example/new.png", 800, 600, "png", 3L
        );
        when(repository.findFeatureAdminMedia(featureId))
                .thenReturn(Optional.of(before), Optional.of(after));
        when(cloudinaryService.uploadToFolder(file, "fujipp/features/welcome"))
                .thenReturn(uploaded);

        FeatureMediaResponse response = service.uploadImage(
                featureId, "Welcome feature", file
        );

        verify(repository).replaceFeatureImage(
                featureId,
                "new/public-id",
                "https://cdn.example/new.png",
                800,
                600,
                "png",
                3L,
                "Welcome feature"
        );
        verify(cloudinaryService).delete("old/public-id");
        assertThat(response.url()).isEqualTo("https://cdn.example/new.png");
    }

    @Test
    void rejectsUnsupportedImageTypesBeforeCloudinaryUpload() {
        UUID featureId = UUID.randomUUID();
        when(repository.findFeatureAdminMedia(featureId))
                .thenReturn(Optional.of(feature("welcome", null)));
        MockMultipartFile file = new MockMultipartFile(
                "file", "feature.svg", "image/svg+xml", new byte[]{1}
        );

        assertThatThrownBy(() -> service.uploadImage(featureId, null, file))
                .isInstanceOf(StoreValidationException.class);

        verify(cloudinaryService, never()).uploadToFolder(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    private StoreRepository.FeatureAdminMedia feature(String code, String publicId) {
        return new StoreRepository.FeatureAdminMedia(
                code, publicId, null, null, null, null, null, null, null
        );
    }
}
