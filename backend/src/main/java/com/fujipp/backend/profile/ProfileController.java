package com.fujipp.backend.profile;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/auth/me")
public class ProfileController {

    private final ProfileService profileService;
    private final ProfileAvatarService profileAvatarService;

    public ProfileController(ProfileService profileService, ProfileAvatarService profileAvatarService) {
        this.profileService = profileService;
        this.profileAvatarService = profileAvatarService;
    }

    @GetMapping("/profile")
    public ProfileResponse getProfile(@AuthenticationPrincipal Jwt jwt) {
        return profileService.getProfile(jwt.getSubject());
    }

    @PutMapping("/profile")
    public ProfileResponse updateProfile(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return profileService.updateProfile(jwt.getSubject(), request);
    }

    @PutMapping("/username")
    public ProfileResponse setUsername(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody SetUsernameRequest request
    ) {
        return profileService.setUsername(jwt.getSubject(), request);
    }

    @PostMapping(path = "/avatar", consumes = "multipart/form-data")
    public ProfileResponse uploadAvatar(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam MultipartFile file
    ) {
        return profileAvatarService.upload(jwt.getSubject(), file);
    }

    @DeleteMapping("/avatar")
    public ProfileResponse deleteAvatar(@AuthenticationPrincipal Jwt jwt) {
        return profileAvatarService.delete(jwt.getSubject());
    }

    @DeleteMapping("/account")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateAccount(@AuthenticationPrincipal Jwt jwt) {
        profileService.deactivateAccount(jwt.getSubject());
    }
}
