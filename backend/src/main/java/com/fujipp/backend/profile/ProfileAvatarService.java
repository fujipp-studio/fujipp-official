package com.fujipp.backend.profile;

import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.work.admin.CloudinaryException;
import com.fujipp.backend.work.admin.CloudinaryService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
public class ProfileAvatarService {

    private final CurrentUserService currentUserService;
    private final CurrentUserRepository currentUserRepository;
    private final CloudinaryService cloudinaryService;
    private final String profileFolder;
    private final long maxFileSizeBytes;

    public ProfileAvatarService(
            CurrentUserService currentUserService,
            CurrentUserRepository currentUserRepository,
            CloudinaryService cloudinaryService,
            @Value("${app.cloudinary.profile-folder:fujipp/profiles}") String profileFolder,
            @Value("${app.cloudinary.max-file-size-bytes:8388608}") long maxFileSizeBytes
    ) {
        this.currentUserService = currentUserService;
        this.currentUserRepository = currentUserRepository;
        this.cloudinaryService = cloudinaryService;
        this.profileFolder = profileFolder;
        this.maxFileSizeBytes = maxFileSizeBytes;
    }

    @Transactional
    public ProfileResponse upload(String subject, MultipartFile file) {
        CurrentUserRepository.AccountProfile account = currentUserService.getActiveAccount(subject);
        validateImage(file);
        CurrentUserRepository.AvatarRecord previous = currentUserRepository
                .findAvatarByUserId(account.id())
                .orElseThrow(() -> new ProfileValidationException("Profile was not found"));
        CloudinaryService.UploadedMedia uploaded = cloudinaryService.uploadToFolder(
                file,
                profileFolder + "/" + account.id()
        );

        try {
            if (!currentUserRepository.replaceAvatar(
                    account.id(),
                    uploaded.secureUrl(),
                    uploaded.publicId()
            )) {
                throw new ProfileValidationException("Profile was not found");
            }
        } catch (RuntimeException exception) {
            deleteQuietly(uploaded.publicId());
            throw exception;
        }

        if ("CLOUDINARY".equals(previous.source()) && previous.publicId() != null) {
            deleteQuietly(previous.publicId());
        }
        return reload(account.id());
    }

    @Transactional
    public ProfileResponse delete(String subject) {
        CurrentUserRepository.AccountProfile account = currentUserService.getActiveAccount(subject);
        CurrentUserRepository.AvatarRecord previous = currentUserRepository
                .findAvatarByUserId(account.id())
                .orElseThrow(() -> new ProfileValidationException("Profile was not found"));
        if (!currentUserRepository.clearAvatar(account.id())) {
            throw new ProfileValidationException("Profile was not found");
        }
        if ("CLOUDINARY".equals(previous.source()) && previous.publicId() != null) {
            deleteQuietly(previous.publicId());
        }
        return reload(account.id());
    }

    private void validateImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ProfileValidationException("file is required");
        }
        if (file.getSize() > maxFileSizeBytes) {
            throw new ProfileValidationException("file exceeds the configured maximum size");
        }
        if (!List.of("image/jpeg", "image/png", "image/webp").contains(file.getContentType())) {
            throw new ProfileValidationException("file must be a JPEG, PNG, or WebP image");
        }
    }

    private ProfileResponse reload(java.util.UUID userId) {
        return currentUserRepository.findById(userId)
                .map(ProfileResponse::from)
                .orElseThrow(() -> new ProfileValidationException("Profile was not found"));
    }

    private void deleteQuietly(String publicId) {
        try {
            cloudinaryService.delete(publicId);
        } catch (CloudinaryException ignored) {
            // The database record remains authoritative; stale media can be cleaned later.
        }
    }
}
