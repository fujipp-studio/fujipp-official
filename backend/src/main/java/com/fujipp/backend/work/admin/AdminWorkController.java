package com.fujipp.backend.work.admin;

import com.fujipp.backend.work.WorkLocale;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/works")
@PreAuthorize("hasAnyRole('EDITOR', 'ADMIN')")
public class AdminWorkController {

    private final AdminWorkService adminWorkService;

    public AdminWorkController(AdminWorkService adminWorkService) {
        this.adminWorkService = adminWorkService;
    }

    @GetMapping
    public List<AdminWorkResponse> listWorks() {
        return adminWorkService.list();
    }

    @GetMapping("/catalog")
    public AdminWorkCatalogResponse getCatalog() {
        return adminWorkService.catalog();
    }

    @GetMapping("/{id}")
    public AdminWorkResponse getWork(@PathVariable UUID id) {
        return adminWorkService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AdminWorkResponse createWork(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateWorkRequest request
    ) {
        return adminWorkService.create(jwt.getSubject(), request);
    }

    @PutMapping("/{id}")
    public AdminWorkResponse updateWork(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateWorkRequest request
    ) {
        return adminWorkService.update(jwt.getSubject(), id, request);
    }

    @PutMapping("/{id}/translations/{locale}")
    public AdminWorkResponse upsertTranslation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable WorkLocale locale,
            @Valid @RequestBody UpsertWorkTranslationRequest request
    ) {
        return adminWorkService.upsertTranslation(jwt.getSubject(), id, locale, request);
    }

    @PutMapping("/{id}/positions")
    public AdminWorkResponse replacePositions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody OrderedCodesRequest request
    ) {
        return adminWorkService.replacePositions(jwt.getSubject(), id, request);
    }

    @PutMapping("/{id}/technologies")
    public AdminWorkResponse replaceTechnologies(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody OrderedCodesRequest request
    ) {
        return adminWorkService.replaceTechnologies(jwt.getSubject(), id, request);
    }

    @GetMapping("/{id}/links")
    public List<AdminWorkLinkResponse> listLinks(@PathVariable UUID id) {
        return adminWorkService.listLinks(id);
    }

    @PostMapping("/{id}/links")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminWorkLinkResponse createLink(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody UpsertWorkLinkRequest request
    ) {
        return adminWorkService.createLink(jwt.getSubject(), id, request);
    }

    @PutMapping("/{id}/links/{linkId}")
    public AdminWorkLinkResponse updateLink(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID linkId,
            @Valid @RequestBody UpsertWorkLinkRequest request
    ) {
        return adminWorkService.updateLink(jwt.getSubject(), id, linkId, request);
    }

    @DeleteMapping("/{id}/links/{linkId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLink(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID linkId
    ) {
        adminWorkService.deleteLink(jwt.getSubject(), id, linkId);
    }

    @GetMapping("/{id}/content")
    public List<AdminWorkContentResponse> listContent(@PathVariable UUID id) {
        return adminWorkService.listContent(id);
    }

    @PostMapping("/{id}/content")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminWorkContentResponse createContent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody CreateWorkContentRequest request
    ) {
        return adminWorkService.createContent(jwt.getSubject(), id, request);
    }

    @PutMapping("/{id}/content/{contentId}")
    public AdminWorkContentResponse updateContent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID contentId,
            @Valid @RequestBody UpdateWorkContentRequest request
    ) {
        return adminWorkService.updateContent(jwt.getSubject(), id, contentId, request);
    }

    @PutMapping("/{id}/content/{contentId}/translations/{locale}")
    public AdminWorkContentResponse upsertContentTranslation(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID contentId,
            @PathVariable WorkLocale locale,
            @Valid @RequestBody UpsertContentTranslationRequest request
    ) {
        return adminWorkService.upsertContentTranslation(
                jwt.getSubject(),
                id,
                contentId,
                locale,
                request
        );
    }

    @DeleteMapping("/{id}/content/{contentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteContent(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID contentId
    ) {
        adminWorkService.deleteContent(jwt.getSubject(), id, contentId);
    }

    @GetMapping("/{id}/media")
    public List<AdminWorkMediaResponse> listMedia(@PathVariable UUID id) {
        return adminWorkService.listMedia(id);
    }

    @PostMapping(path = "/{id}/media", consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminWorkMediaResponse uploadMedia(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @RequestParam WorkMediaType type,
            @RequestParam int sortOrder,
            @RequestParam(required = false) String altText,
            @RequestParam MultipartFile file
    ) {
        return adminWorkService.uploadMedia(
                jwt.getSubject(),
                id,
                type,
                sortOrder,
                altText,
                file
        );
    }

    @PutMapping("/{id}/media/{mediaId}")
    public AdminWorkMediaResponse updateMedia(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID mediaId,
            @Valid @RequestBody UpdateWorkMediaRequest request
    ) {
        return adminWorkService.updateMedia(jwt.getSubject(), id, mediaId, request);
    }

    @DeleteMapping("/{id}/media/{mediaId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteMedia(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @PathVariable UUID mediaId
    ) {
        adminWorkService.deleteMedia(jwt.getSubject(), id, mediaId);
    }

    @PostMapping("/{id}/publish")
    public AdminWorkResponse publish(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PublishWorkRequest request
    ) {
        return adminWorkService.publish(jwt.getSubject(), id, request);
    }

    @PostMapping("/{id}/unpublish")
    public AdminWorkResponse unpublish(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id
    ) {
        return adminWorkService.unpublish(jwt.getSubject(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWork(@PathVariable UUID id) {
        adminWorkService.delete(id);
    }
}
