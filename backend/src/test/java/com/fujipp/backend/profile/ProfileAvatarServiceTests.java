package com.fujipp.backend.profile;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
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

class ProfileAvatarServiceTests {

    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final CurrentUserRepository repository = mock(CurrentUserRepository.class);
    private final CloudinaryService cloudinaryService = mock(CloudinaryService.class);
    private final ProfileAvatarService service = new ProfileAvatarService(
            currentUserService,
            repository,
            cloudinaryService,
            "fujipp/profiles",
            8_388_608
    );

    @Test
    void uploadsAndReplacesTheCurrentAvatar() {
        UUID userId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.png",
                "image/png",
                new byte[]{1, 2, 3}
        );
        CurrentUserRepository.AccountProfile before = account(userId, "https://old.example/avatar.png");
        CurrentUserRepository.AccountProfile after = account(userId, "https://new.example/avatar.png");
        when(currentUserService.getActiveAccount(userId.toString())).thenReturn(before);
        when(repository.findAvatarByUserId(userId)).thenReturn(Optional.of(
                new CurrentUserRepository.AvatarRecord(
                        before.avatarUrl(),
                        "fujipp/profiles/old",
                        "CLOUDINARY"
                )
        ));
        when(cloudinaryService.uploadToFolder(file, "fujipp/profiles/" + userId))
                .thenReturn(new CloudinaryService.UploadedMedia(
                        "fujipp/profiles/new",
                        after.avatarUrl(),
                        256,
                        256,
                        "png",
                        3L
                ));
        when(repository.replaceAvatar(userId, after.avatarUrl(), "fujipp/profiles/new"))
                .thenReturn(true);
        when(repository.findById(userId)).thenReturn(Optional.of(after));

        ProfileResponse response = service.upload(userId.toString(), file);

        assertThat(response.avatarUrl()).isEqualTo(after.avatarUrl());
        verify(cloudinaryService).delete("fujipp/profiles/old");
    }

    @Test
    void removesACloudinaryAvatar() {
        UUID userId = UUID.randomUUID();
        CurrentUserRepository.AccountProfile before = account(userId, "https://old.example/avatar.png");
        CurrentUserRepository.AccountProfile after = account(userId, null);
        when(currentUserService.getActiveAccount(userId.toString())).thenReturn(before);
        when(repository.findAvatarByUserId(userId)).thenReturn(Optional.of(
                new CurrentUserRepository.AvatarRecord(
                        before.avatarUrl(),
                        "fujipp/profiles/old",
                        "CLOUDINARY"
                )
        ));
        when(repository.clearAvatar(userId)).thenReturn(true);
        when(repository.findById(userId)).thenReturn(Optional.of(after));

        ProfileResponse response = service.delete(userId.toString());

        assertThat(response.avatarUrl()).isNull();
        verify(cloudinaryService).delete("fujipp/profiles/old");
    }

    @Test
    void rejectsUnsupportedAvatarContent() {
        UUID userId = UUID.randomUUID();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "avatar.gif",
                "image/gif",
                new byte[]{1}
        );
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, null));

        assertThatThrownBy(() -> service.upload(userId.toString(), file))
                .isInstanceOf(ProfileValidationException.class);
        verify(cloudinaryService, never()).uploadToFolder(file, "fujipp/profiles/" + userId);
    }

    private CurrentUserRepository.AccountProfile account(UUID userId, String avatarUrl) {
        return new CurrentUserRepository.AccountProfile(
                userId,
                AppRole.USER,
                AccountStatus.ACTIVE,
                "fujipp",
                "Fujipp",
                null,
                null,
                avatarUrl,
                null
        );
    }
}
