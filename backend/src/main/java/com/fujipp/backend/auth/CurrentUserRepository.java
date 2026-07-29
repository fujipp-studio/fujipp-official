package com.fujipp.backend.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public class CurrentUserRepository {

    private static final String FIND_BY_ID = """
            SELECT account.user_id,
                   account.role::text,
                   account.status::text,
                   profile.username,
                   profile.display_name,
                   profile.first_name,
                   profile.last_name,
                   profile.avatar_url,
                   profile.profile_completed_at
              FROM private.user_accounts AS account
              JOIN public.profiles AS profile
                ON profile.id = account.user_id
             WHERE account.user_id = ?
            """;

    private final JdbcTemplate jdbcTemplate;

    public CurrentUserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AccountProfile> findById(UUID userId) {
        return jdbcTemplate.query(
                FIND_BY_ID,
                (resultSet, rowNumber) -> new AccountProfile(
                        resultSet.getObject("user_id", UUID.class),
                        AppRole.valueOf(resultSet.getString("role")),
                        AccountStatus.valueOf(resultSet.getString("status")),
                        resultSet.getString("username"),
                        resultSet.getString("display_name"),
                        resultSet.getString("first_name"),
                        resultSet.getString("last_name"),
                        resultSet.getString("avatar_url"),
                        resultSet.getObject("profile_completed_at", java.time.OffsetDateTime.class)
                ),
                userId
        ).stream().findFirst();
    }

    public void updateProfile(
            UUID userId,
            String displayName,
            String firstName,
            String lastName
    ) {
        jdbcTemplate.update(
                """
                UPDATE public.profiles
                   SET display_name = ?,
                       first_name = ?,
                       last_name = ?
                 WHERE id = ?
                """,
                displayName,
                firstName,
                lastName,
                userId
        );
    }

    public boolean setUsername(UUID userId, String username) {
        return jdbcTemplate.update(
                """
                UPDATE public.profiles
                   SET username = ?
                 WHERE id = ?
                   AND username IS NULL
                """,
                username,
                userId
        ) == 1;
    }

    public boolean usernameExists(String username) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM public.profiles
                     WHERE lower(username) = lower(?)
                )
                """,
                Boolean.class,
                username
        );
        return Boolean.TRUE.equals(exists);
    }

    public boolean usernameIsReserved(String username) {
        Boolean reserved = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM private.reserved_usernames
                     WHERE username = lower(?)
                )
                """,
                Boolean.class,
                username
        );
        return Boolean.TRUE.equals(reserved);
    }

    public record AccountProfile(
            UUID id,
            AppRole role,
            AccountStatus status,
            String username,
            String displayName,
            String firstName,
            String lastName,
            String avatarUrl,
            java.time.OffsetDateTime profileCompletedAt
    ) {
    }
}
