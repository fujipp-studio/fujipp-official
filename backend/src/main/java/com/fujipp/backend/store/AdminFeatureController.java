package com.fujipp.backend.store;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/store/features")
@PreAuthorize("hasRole('ADMIN')")
public class AdminFeatureController {

    private final AdminFeatureService adminFeatureService;

    public AdminFeatureController(AdminFeatureService adminFeatureService) {
        this.adminFeatureService = adminFeatureService;
    }

    @GetMapping("/{featureId}/media")
    public FeatureMediaResponse get(@PathVariable UUID featureId) {
        return adminFeatureService.get(featureId);
    }

    @PutMapping("/{featureId}/tutorial")
    public FeatureMediaResponse updateTutorial(
            @PathVariable UUID featureId,
            @Valid @RequestBody UpdateFeatureTutorialRequest request
    ) {
        return adminFeatureService.updateTutorial(featureId, request);
    }

    @PostMapping(path = "/{featureId}/image", consumes = "multipart/form-data")
    public FeatureMediaResponse uploadImage(
            @PathVariable UUID featureId,
            @RequestParam(required = false) String altText,
            @RequestParam MultipartFile file
    ) {
        return adminFeatureService.uploadImage(featureId, altText, file);
    }

    @DeleteMapping("/{featureId}/image")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteImage(@PathVariable UUID featureId) {
        adminFeatureService.deleteImage(featureId);
    }
    @GetMapping
    public List<AdminStoreResponses.Feature> list() {
        return adminFeatureService.list();
    }

    @PutMapping("/{featureId}")
    public AdminStoreResponses.Feature update(
            @PathVariable UUID featureId,
            @Valid @RequestBody AdminStoreRequests.UpdateFeatureRequest request
    ) {
        return adminFeatureService.update(featureId, request);
    }

    @PutMapping("/{featureId}/offers/{offerId}")
    public AdminStoreResponses.Feature updateOffer(
            @PathVariable UUID featureId,
            @PathVariable UUID offerId,
            @Valid @RequestBody AdminStoreRequests.UpdateOfferRequest request
    ) {
        return adminFeatureService.updateOffer(featureId, offerId, request);
    }

    @PostMapping("/{featureId}/offers")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminStoreResponses.Feature createOffer(
            @PathVariable UUID featureId,
            @Valid @RequestBody AdminStoreRequests.CreateOfferRequest request
    ) {
        return adminFeatureService.createOffer(featureId, request);
    }

    @PostMapping("/{featureId}/publish")
    public AdminStoreResponses.Feature publish(@PathVariable UUID featureId) {
        return adminFeatureService.publish(featureId);
    }
}
