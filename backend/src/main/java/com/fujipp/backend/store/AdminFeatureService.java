package com.fujipp.backend.store;

import com.fujipp.backend.work.admin.CloudinaryException;
import com.fujipp.backend.work.admin.CloudinaryService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AdminFeatureService {

    private static final Pattern YOUTUBE_URL = Pattern.compile(
            "^https://(?:www\\.)?(?:youtube\\.com/(?:watch\\?[^#]*v=[A-Za-z0-9_-]{6,}|shorts/[A-Za-z0-9_-]{6,})(?:[&#?].*)?|youtu\\.be/[A-Za-z0-9_-]{6,}(?:[?&#].*)?)$",
            Pattern.CASE_INSENSITIVE
    );

    private final StoreRepository repository;
    private final CloudinaryService cloudinaryService;
    private final String featureFolder;
    private final long maxFileSizeBytes;

    public AdminFeatureService(
            StoreRepository repository,
            CloudinaryService cloudinaryService,
            @Value("${app.cloudinary.feature-folder:fujipp/features}") String featureFolder,
            @Value("${app.cloudinary.max-file-size-bytes:8388608}") long maxFileSizeBytes
    ) {
        this.repository = repository;
        this.cloudinaryService = cloudinaryService;
        this.featureFolder = featureFolder;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @Transactional(readOnly = true)
    public FeatureMediaResponse get(UUID featureId) {
        return FeatureMediaResponse.from(requireFeature(featureId));
    }

    @Transactional
    public FeatureMediaResponse updateTutorial(
            UUID featureId,
            UpdateFeatureTutorialRequest request
    ) {
        requireFeature(featureId);
        String tutorialUrl = normalize(request.tutorialUrl());
        if (tutorialUrl != null && !YOUTUBE_URL.matcher(tutorialUrl).matches()) {
            throw new StoreValidationException(
                    "tutorialUrl must be an HTTPS YouTube watch, Shorts, or youtu.be URL"
            );
        }
        if (!repository.updateTutorialUrl(featureId, tutorialUrl)) {
            throw new StoreNotFoundException("Feature product was not found");
        }
        return FeatureMediaResponse.from(requireFeature(featureId));
    }

    @Transactional
    public FeatureMediaResponse uploadImage(
            UUID featureId,
            String altText,
            MultipartFile file
    ) {
        StoreRepository.FeatureAdminMedia existing = requireFeature(featureId);
        validateImage(file, altText);
        String normalizedAlt = normalize(altText);
        CloudinaryService.UploadedMedia uploaded = cloudinaryService.uploadToFolder(
                file,
                featureFolder + "/" + existing.code()
        );

        try {
            repository.replaceFeatureImage(
                    featureId,
                    uploaded.publicId(),
                    uploaded.secureUrl(),
                    uploaded.width(),
                    uploaded.height(),
                    uploaded.format(),
                    uploaded.bytes(),
                    normalizedAlt
            );
        } catch (RuntimeException exception) {
            try {
                cloudinaryService.delete(uploaded.publicId());
            } catch (CloudinaryException ignored) {
                // Preserve the database failure as the actionable error.
            }
            throw exception;
        }

        if (existing.publicId() != null) {
            try {
                cloudinaryService.delete(existing.publicId());
            } catch (CloudinaryException ignored) {
                // The new image is already authoritative; stale media can be cleaned later.
            }
        }
        return FeatureMediaResponse.from(requireFeature(featureId));
    }

    @Transactional
    public void deleteImage(UUID featureId) {
        StoreRepository.FeatureAdminMedia existing = requireFeature(featureId);
        if (existing.publicId() == null || !repository.clearFeatureImage(featureId)) {
            throw new StoreNotFoundException("Feature image was not found");
        }
        cloudinaryService.delete(existing.publicId());
    }

    private StoreRepository.FeatureAdminMedia requireFeature(UUID featureId) {
        return repository.findFeatureAdminMedia(featureId)
                .orElseThrow(() -> new StoreNotFoundException("Feature product was not found"));
    }

    private void validateImage(MultipartFile file, String altText) {
        if (file == null || file.isEmpty()) {
            throw new StoreValidationException("file is required");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new StoreValidationException("file exceeds the configured maximum size");
        }
        if (!List.of("image/jpeg", "image/png", "image/webp")
                .contains(file.getContentType())) {
            throw new StoreValidationException("file must be a JPEG, PNG, or WebP image");
        }
        if (altText != null && altText.trim().length() > 255) {
            throw new StoreValidationException("altText cannot exceed 255 characters");
        }
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
