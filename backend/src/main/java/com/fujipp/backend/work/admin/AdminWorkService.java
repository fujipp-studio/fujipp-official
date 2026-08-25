package com.fujipp.backend.work.admin;

import com.fujipp.backend.work.WorkLocale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.List;
import java.util.HashSet;
import java.util.UUID;

@Service
public class AdminWorkService {

    private final AdminWorkRepository repository;
    private final CloudinaryService cloudinaryService;
    private final long maxFileSizeBytes;

    public AdminWorkService(
            AdminWorkRepository repository,
            CloudinaryService cloudinaryService,
            @Value("${app.cloudinary.max-file-size-bytes:8388608}") long maxFileSizeBytes
    ) {
        this.repository = repository;
        this.cloudinaryService = cloudinaryService;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @Transactional(readOnly = true)
    public List<AdminWorkResponse> list() {
        return repository.findAll();
    }

    @Transactional(readOnly = true)
    public AdminWorkCatalogResponse catalog() {
        return repository.findCatalog();
    }

    @Transactional
    public AdminWorkCatalogResponse.Technology createTechnology(CreateTechnologyRequest request) {
        if (!repository.activeTechnologyGroupExists(request.groupCode())) {
            throw new AdminWorkValidationException("Technology group must reference an active group");
        }
        try {
            return repository.createTechnology(request);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException("A technology already uses this slug");
        }
    }

    @Transactional(readOnly = true)
    public AdminWorkResponse get(UUID id) {
        return reload(id);
    }

    @Transactional
    public AdminWorkResponse create(String subject, CreateWorkRequest request) {
        validateDates(request.status(), request.startedOn(), request.completedOn());
        validateCategory(request.categoryCode());
        validateSlug(request.slug(), null);

        try {
            UUID id = repository.create(UUID.fromString(subject), request);
            return reload(id);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException("The work could not be created with these values");
        }
    }

    @Transactional
    public AdminWorkResponse update(
            String subject,
            UUID id,
            UpdateWorkRequest request
    ) {
        requireExists(id);
        validateDates(request.status(), request.startedOn(), request.completedOn());
        validateCategory(request.categoryCode());
        validateSlug(request.slug(), id);

        try {
            if (!repository.update(UUID.fromString(subject), id, request)) {
                throw new AdminWorkNotFoundException();
            }
            return reload(id);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException("The work could not be updated with these values");
        }
    }

    @Transactional
    public AdminWorkResponse upsertTranslation(
            String subject,
            UUID id,
            WorkLocale locale,
            UpsertWorkTranslationRequest request
    ) {
        requireExists(id);
        if (!repository.upsertTranslation(id, locale.name(), request)) {
            throw new AdminWorkNotFoundException();
        }
        repository.touch(UUID.fromString(subject), id);
        return reload(id);
    }

    @Transactional
    public AdminWorkResponse replacePositions(
            String subject,
            UUID id,
            OrderedCodesRequest request
    ) {
        requireExists(id);
        validateUniqueCodes(request.codes());
        if (repository.countActivePositions(request.codes()) != request.codes().size()) {
            throw new AdminWorkValidationException(
                    "Every position code must reference an active position"
            );
        }
        repository.replacePositions(id, request.codes());
        repository.touch(UUID.fromString(subject), id);
        return reload(id);
    }

    @Transactional
    public AdminWorkResponse replaceTechnologies(
            String subject,
            UUID id,
            OrderedCodesRequest request
    ) {
        requireExists(id);
        validateUniqueCodes(request.codes());
        if (repository.countActiveTechnologies(request.codes()) != request.codes().size()) {
            throw new AdminWorkValidationException(
                    "Every technology code must reference an active technology"
            );
        }
        repository.replaceTechnologies(id, request.codes());
        repository.touch(UUID.fromString(subject), id);
        return reload(id);
    }

    @Transactional(readOnly = true)
    public List<AdminWorkLinkResponse> listLinks(UUID id) {
        requireExists(id);
        return repository.findLinks(id);
    }

    @Transactional
    public AdminWorkLinkResponse createLink(
            String subject,
            UUID id,
            UpsertWorkLinkRequest request
    ) {
        requireExists(id);
        try {
            UUID linkId = repository.createLink(id, request);
            repository.touch(UUID.fromString(subject), id);
            return repository.findLink(id, linkId)
                    .orElseThrow(AdminWorkNotFoundException::new);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException(
                    "Another link already uses this sortOrder"
            );
        }
    }

    @Transactional
    public AdminWorkLinkResponse updateLink(
            String subject,
            UUID id,
            UUID linkId,
            UpsertWorkLinkRequest request
    ) {
        requireExists(id);
        try {
            if (!repository.updateLink(id, linkId, request)) {
                throw new AdminWorkNotFoundException();
            }
            repository.touch(UUID.fromString(subject), id);
            return repository.findLink(id, linkId)
                    .orElseThrow(AdminWorkNotFoundException::new);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException(
                    "Another link already uses this sortOrder"
            );
        }
    }

    @Transactional
    public void deleteLink(String subject, UUID id, UUID linkId) {
        requireExists(id);
        if (!repository.deleteLink(id, linkId)) {
            throw new AdminWorkNotFoundException();
        }
        repository.touch(UUID.fromString(subject), id);
    }

    @Transactional(readOnly = true)
    public List<AdminWorkContentResponse> listContent(UUID id) {
        requireExists(id);
        return repository.findContent(id);
    }

    @Transactional
    public AdminWorkContentResponse createContent(
            String subject,
            UUID id,
            CreateWorkContentRequest request
    ) {
        requireExists(id);
        try {
            UUID contentId = repository.createContent(id, request);
            repository.touch(UUID.fromString(subject), id);
            return reloadContent(id, contentId);
        } catch (DataIntegrityViolationException exception) {
            throw contentConflict();
        }
    }

    @Transactional
    public AdminWorkContentResponse updateContent(
            String subject,
            UUID id,
            UUID contentId,
            UpdateWorkContentRequest request
    ) {
        requireExists(id);
        try {
            if (!repository.updateContent(id, contentId, request)) {
                throw new AdminWorkNotFoundException();
            }
            repository.touch(UUID.fromString(subject), id);
            return reloadContent(id, contentId);
        } catch (DataIntegrityViolationException exception) {
            throw contentConflict();
        }
    }

    @Transactional
    public AdminWorkContentResponse upsertContentTranslation(
            String subject,
            UUID id,
            UUID contentId,
            WorkLocale locale,
            UpsertContentTranslationRequest request
    ) {
        requireExists(id);
        reloadContent(id, contentId);
        if (!repository.upsertContentTranslation(contentId, locale.name(), request)) {
            throw new AdminWorkNotFoundException();
        }
        repository.touch(UUID.fromString(subject), id);
        return reloadContent(id, contentId);
    }

    @Transactional
    public void deleteContent(String subject, UUID id, UUID contentId) {
        requireExists(id);
        try {
            if (!repository.deleteContent(id, contentId)) {
                throw new AdminWorkNotFoundException();
            }
            repository.touch(UUID.fromString(subject), id);
        } catch (DataIntegrityViolationException exception) {
            throw contentConflict();
        }
    }

    @Transactional(readOnly = true)
    public List<AdminWorkMediaResponse> listMedia(UUID id) {
        requireExists(id);
        return repository.findMedia(id);
    }

    @Transactional
    public AdminWorkMediaResponse uploadMedia(
            String subject,
            UUID id,
            WorkMediaType type,
            int sortOrder,
            String altText,
            MultipartFile file
    ) {
        AdminWorkResponse work = reload(id);
        validateMedia(type, sortOrder, altText, file);

        int existingCount = repository.countMedia(id, type.name());
        if (type == WorkMediaType.GALLERY && existingCount >= 5) {
            throw new AdminWorkConflictException(
                    "A work can contain at most five gallery images"
            );
        }
        if (type == WorkMediaType.ARCHITECTURE && existingCount >= 1) {
            throw new AdminWorkConflictException(
                    "A work can contain only one architecture image"
            );
        }

        CloudinaryService.UploadedMedia uploaded = cloudinaryService.upload(file, work.slug());
        try {
            UUID mediaId = repository.createMedia(
                    id,
                    type,
                    uploaded,
                    altText,
                    sortOrder
            );
            repository.touch(UUID.fromString(subject), id);
            return repository.findMediaRecord(id, mediaId)
                    .map(AdminWorkRepository.MediaRecord::response)
                    .orElseThrow(AdminWorkNotFoundException::new);
        } catch (DataIntegrityViolationException exception) {
            try {
                cloudinaryService.delete(uploaded.publicId());
            } catch (CloudinaryException ignored) {
                // The original database conflict remains the actionable error.
            }
            throw new AdminWorkConflictException(
                    "Another image already uses this media type or sortOrder"
            );
        }
    }

    @Transactional
    public AdminWorkMediaResponse updateMedia(
            String subject,
            UUID id,
            UUID mediaId,
            UpdateWorkMediaRequest request
    ) {
        requireExists(id);
        AdminWorkRepository.MediaRecord media = repository.findMediaRecord(id, mediaId)
                .orElseThrow(AdminWorkNotFoundException::new);
        validateMediaOrder(WorkMediaType.valueOf(media.response().type()), request.sortOrder());

        try {
            if (!repository.updateMedia(id, mediaId, request)) {
                throw new AdminWorkNotFoundException();
            }
            repository.touch(UUID.fromString(subject), id);
            return repository.findMediaRecord(id, mediaId)
                    .map(AdminWorkRepository.MediaRecord::response)
                    .orElseThrow(AdminWorkNotFoundException::new);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException(
                    "Another image already uses this sortOrder"
            );
        }
    }

    @Transactional
    public void deleteMedia(String subject, UUID id, UUID mediaId) {
        requireExists(id);
        AdminWorkRepository.MediaRecord media = repository.findMediaRecord(id, mediaId)
                .orElseThrow(AdminWorkNotFoundException::new);
        cloudinaryService.delete(media.cloudinaryPublicId());
        if (!repository.deleteMedia(id, mediaId)) {
            throw new AdminWorkNotFoundException();
        }
        repository.touch(UUID.fromString(subject), id);
    }

    @Transactional
    public AdminWorkResponse publish(
            String subject,
            UUID id,
            PublishWorkRequest request
    ) {
        requireExists(id);
        if (request.featured() && request.featuredOrder() == null) {
            throw new AdminWorkValidationException(
                    "featuredOrder is required when the work is featured"
            );
        }
        if (!request.featured() && request.featuredOrder() != null) {
            throw new AdminWorkValidationException(
                    "featuredOrder must be null when the work is not featured"
            );
        }

        AdminWorkRepository.PublishReadiness readiness = repository.getPublishReadiness(id);
        if (readiness.translationCount() != WorkLocale.values().length) {
            throw new AdminWorkConflictException(
                    "Both th and en translations are required before publishing"
            );
        }
        if (readiness.incompleteContentCount() > 0) {
            throw new AdminWorkConflictException(
                    "Every content item requires both th and en translations before publishing"
            );
        }

        try {
            if (!repository.publish(
                    UUID.fromString(subject),
                    id,
                    request.featured(),
                    request.featuredOrder()
            )) {
                throw new AdminWorkNotFoundException();
            }
            return reload(id);
        } catch (DataIntegrityViolationException exception) {
            throw new AdminWorkConflictException("The work could not be published");
        }
    }

    @Transactional
    public AdminWorkResponse unpublish(String subject, UUID id) {
        requireExists(id);
        if (!repository.unpublish(UUID.fromString(subject), id)) {
            throw new AdminWorkNotFoundException();
        }
        return reload(id);
    }

    @Transactional
    public void delete(UUID id) {
        AdminWorkResponse work = reload(id);
        if (!"DRAFT".equals(work.publicationStatus())) {
            throw new AdminWorkConflictException(
                    "Unpublish the work before deleting it"
            );
        }
        if (!repository.deleteDraft(id)) {
            throw new AdminWorkNotFoundException();
        }
    }

    private AdminWorkResponse reload(UUID id) {
        return repository.findById(id).orElseThrow(AdminWorkNotFoundException::new);
    }

    private void requireExists(UUID id) {
        if (repository.findById(id).isEmpty()) {
            throw new AdminWorkNotFoundException();
        }
    }

    private void validateCategory(String categoryCode) {
        if (!repository.categoryExists(categoryCode)) {
            throw new AdminWorkValidationException(
                    "categoryCode must reference an active category"
            );
        }
    }

    private void validateSlug(String slug, UUID excludedId) {
        if (repository.slugExists(slug, excludedId)) {
            throw new AdminWorkConflictException("The work slug is already in use");
        }
    }

    private void validateUniqueCodes(List<String> codes) {
        if (new HashSet<>(codes).size() != codes.size()) {
            throw new AdminWorkValidationException("codes cannot contain duplicates");
        }
    }

    private AdminWorkContentResponse reloadContent(UUID projectId, UUID contentId) {
        return repository.findContent(projectId, contentId)
                .orElseThrow(AdminWorkNotFoundException::new);
    }

    private AdminWorkConflictException contentConflict() {
        return new AdminWorkConflictException(
                "Content order must be unique and published content structure cannot be changed"
        );
    }

    private void validateMedia(
            WorkMediaType type,
            int sortOrder,
            String altText,
            MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw new AdminWorkValidationException("file is required");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new AdminWorkValidationException(
                    "file exceeds the configured maximum size"
            );
        }
        if (!List.of("image/jpeg", "image/png", "image/webp")
                .contains(file.getContentType())) {
            throw new AdminWorkValidationException(
                    "file must be a JPEG, PNG, or WebP image"
            );
        }
        if (altText != null && altText.trim().length() > 255) {
            throw new AdminWorkValidationException(
                    "altText cannot exceed 255 characters"
            );
        }
        validateMediaOrder(type, sortOrder);
    }

    private void validateMediaOrder(WorkMediaType type, int sortOrder) {
        if (type == WorkMediaType.GALLERY && (sortOrder < 1 || sortOrder > 5)) {
            throw new AdminWorkValidationException(
                    "Gallery sortOrder must be between 1 and 5"
            );
        }
        if (type == WorkMediaType.ARCHITECTURE && sortOrder != 1) {
            throw new AdminWorkValidationException(
                    "Architecture sortOrder must be 1"
            );
        }
    }

    private void validateDates(
            WorkStatus status,
            LocalDate startedOn,
            LocalDate completedOn
    ) {
        if (startedOn != null && completedOn != null && completedOn.isBefore(startedOn)) {
            throw new AdminWorkValidationException(
                    "completedOn cannot be before startedOn"
            );
        }
        if (status == WorkStatus.COMPLETED && completedOn == null) {
            throw new AdminWorkValidationException(
                    "completedOn is required when status is COMPLETED"
            );
        }
    }
}
