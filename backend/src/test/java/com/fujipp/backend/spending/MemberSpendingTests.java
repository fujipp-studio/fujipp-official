package com.fujipp.backend.spending;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class MemberSpendingTests {
    @Test void requiresAnOperationKeyForRetryableWritesAndValidAmounts() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            UUID bot = UUID.randomUUID();
            assertThat(validator.validate(new MemberSpendingController.AddRequest(bot, "222222222222222222", 100, "interaction-id"))).isEmpty();
            assertThat(validator.validate(new MemberSpendingController.AddRequest(bot, "222222222222222222", 100, ""))).isNotEmpty();
            assertThat(validator.validate(new MemberSpendingController.AddRequest(bot, "222222222222222222", 0, "id"))).isNotEmpty();
            assertThat(validator.validate(new MemberSpendingController.AddRequest(null, "222222222222222222", 100, "id"))).isNotEmpty();
            assertThat(validator.validate(new MemberSpendingController.SetRequest(bot, "222222222222222222", -1L, null, "id"))).isNotEmpty();
            assertThat(validator.validate(new MemberSpendingController.SetRequest(bot, "222222222222222222", null, 0, "id"))).isEmpty();
        }
    }
    @Test void distinguishesCalendarMonthQueriesFromLifetimeQueries() {
        var repository = mock(MemberSpendingRepository.class);
        var service = new MemberSpendingService(repository);
        UUID bot = UUID.randomUUID();
        service.leaderboard(bot, 5, "2026-10");
        verify(repository).leaderboard(bot, 5, LocalDate.of(2026, 10, 1));
        service.leaderboard(bot, 5, null);
        verify(repository).leaderboard(bot, 5, null);
        service.get(bot, "222222222222222222", "2026-09");
        verify(repository).get(bot, "222222222222222222", LocalDate.of(2026, 9, 1));
    }
    @Test void rejectsInvalidMonthQueriesBeforeTheyReachStorage() {
        var repository = mock(MemberSpendingRepository.class);
        var service = new MemberSpendingService(repository);
        for (String month : new String[]{"2026-13", "2026-00", "2026-1", "2026-01' OR true --"})
            assertThatThrownBy(() -> service.leaderboard(UUID.randomUUID(), 5, month)).isInstanceOf(DateTimeParseException.class);
        verifyNoInteractions(repository);
    }
}
