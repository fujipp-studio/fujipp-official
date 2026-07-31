package com.fujipp.backend.work.admin;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.any;

class AdminWorkServiceTests {

    private final AdminWorkRepository repository = mock(AdminWorkRepository.class);
    private final CloudinaryService cloudinaryService = mock(CloudinaryService.class);
    private final AdminWorkService service =
            new AdminWorkService(repository, cloudinaryService, 8_388_608);
    private final UUID actorId = UUID.randomUUID();

    @Test
    void rejectsCompletedWorkWithoutCompletedDate() {
        CreateWorkRequest request = new CreateWorkRequest(
                "portfolio",
                "personal",
                WorkStatus.COMPLETED,
                LocalDate.now(),
                null
        );

        assertThatThrownBy(() -> service.create(actorId.toString(), request))
                .isInstanceOf(AdminWorkValidationException.class);
        verify(repository, never()).create(actorId, request);
    }

    @Test
    void rejectsDuplicateSlug() {
        CreateWorkRequest request = new CreateWorkRequest(
                "portfolio",
                "personal",
                WorkStatus.ACTIVE,
                null,
                null
        );
        when(repository.categoryExists("personal")).thenReturn(true);
        when(repository.slugExists("portfolio", null)).thenReturn(true);

        assertThatThrownBy(() -> service.create(actorId.toString(), request))
                .isInstanceOf(AdminWorkConflictException.class);
    }

    @Test
    void publishRequiresBothTranslations() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));
        when(repository.getPublishReadiness(projectId))
                .thenReturn(new AdminWorkRepository.PublishReadiness(1, 0));

        assertThatThrownBy(() -> service.publish(
                actorId.toString(),
                projectId,
                new PublishWorkRequest(false, null)
        )).isInstanceOf(AdminWorkConflictException.class);
        verify(repository, never()).publish(actorId, projectId, false, null);
    }

    @Test
    void featuredWorkRequiresOrder() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));

        assertThatThrownBy(() -> service.publish(
                actorId.toString(),
                projectId,
                new PublishWorkRequest(true, null)
        )).isInstanceOf(AdminWorkValidationException.class);
    }

    @Test
    void publishedWorkMustBeUnpublishedBeforeDelete() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "PUBLISHED"
        )));

        assertThatThrownBy(() -> service.delete(projectId))
                .isInstanceOf(AdminWorkConflictException.class);
        verify(repository, never()).deleteDraft(projectId);
    }

    @Test
    void positionCodesCannotContainDuplicates() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));

        assertThatThrownBy(() -> service.replacePositions(
                actorId.toString(),
                projectId,
                new OrderedCodesRequest(List.of("backend-engineer", "backend-engineer"))
        )).isInstanceOf(AdminWorkValidationException.class);
        verify(repository, never()).replacePositions(
                projectId,
                List.of("backend-engineer", "backend-engineer")
        );
    }

    @Test
    void allTechnologyCodesMustBeActive() {
        UUID projectId = UUID.randomUUID();
        List<String> codes = List.of("spring-boot", "missing");
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));
        when(repository.countActiveTechnologies(codes)).thenReturn(1);

        assertThatThrownBy(() -> service.replaceTechnologies(
                actorId.toString(),
                projectId,
                new OrderedCodesRequest(codes)
        )).isInstanceOf(AdminWorkValidationException.class);
        verify(repository, never()).replaceTechnologies(projectId, codes);
    }

    @Test
    void databaseProtectionIsReportedWhenPublishedContentIsChanged() {
        UUID projectId = UUID.randomUUID();
        CreateWorkContentRequest request = new CreateWorkContentRequest(
                WorkContentType.FEATURE,
                0
        );
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "PUBLISHED"
        )));
        doThrow(new org.springframework.dao.DataIntegrityViolationException("protected"))
                .when(repository)
                .createContent(projectId, request);

        assertThatThrownBy(() -> service.createContent(
                actorId.toString(),
                projectId,
                request
        )).isInstanceOf(AdminWorkConflictException.class);
    }

    @Test
    void mediaRejectsUnsupportedFileType() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "image.gif",
                "image/gif",
                new byte[]{1, 2, 3}
        );

        assertThatThrownBy(() -> service.uploadMedia(
                actorId.toString(),
                projectId,
                WorkMediaType.GALLERY,
                1,
                "Preview",
                file
        )).isInstanceOf(AdminWorkValidationException.class);
        verify(cloudinaryService, never()).upload(any(), any());
    }

    @Test
    void architectureAllowsOnlyOneImage() {
        UUID projectId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));
        when(repository.countMedia(projectId, "ARCHITECTURE")).thenReturn(1);
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "architecture.png",
                "image/png",
                new byte[]{1, 2, 3}
        );

        assertThatThrownBy(() -> service.uploadMedia(
                actorId.toString(),
                projectId,
                WorkMediaType.ARCHITECTURE,
                1,
                null,
                file
        )).isInstanceOf(AdminWorkConflictException.class);
        verify(cloudinaryService, never()).upload(any(), any());
    }

    @Test
    void deletingMediaRemovesCloudinaryAssetBeforeDatabaseRecord() {
        UUID projectId = UUID.randomUUID();
        UUID mediaId = UUID.randomUUID();
        when(repository.findById(projectId)).thenReturn(Optional.of(work(
                projectId,
                "DRAFT"
        )));
        when(repository.findMediaRecord(projectId, mediaId)).thenReturn(Optional.of(
                new AdminWorkRepository.MediaRecord(
                        mediaId,
                        "fujipp/work/asset",
                        new AdminWorkMediaResponse(
                                mediaId,
                                "GALLERY",
                                "https://example.com/image.png",
                                100,
                                100,
                                "png",
                                100L,
                                null,
                                1
                        )
                )
        ));
        when(repository.deleteMedia(projectId, mediaId)).thenReturn(true);

        service.deleteMedia(actorId.toString(), projectId, mediaId);

        var order = org.mockito.Mockito.inOrder(cloudinaryService, repository);
        order.verify(cloudinaryService).delete("fujipp/work/asset");
        order.verify(repository).deleteMedia(projectId, mediaId);
    }

    private AdminWorkResponse work(UUID id, String publicationStatus) {
        OffsetDateTime now = OffsetDateTime.now();
        return new AdminWorkResponse(
                id,
                "portfolio",
                "personal",
                "Personal Project",
                "ACTIVE",
                publicationStatus,
                null,
                null,
                false,
                null,
                null,
                now,
                now,
                List.of(),
                List.of(),
                List.of()
        );
    }
}
