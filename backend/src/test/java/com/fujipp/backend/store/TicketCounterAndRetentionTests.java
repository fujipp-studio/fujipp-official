package com.fujipp.backend.store;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import java.util.*;
import java.time.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class TicketCounterAndRetentionTests {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final TicketCounterService counters=new TicketCounterService(jdbc);
    private final UUID bot=UUID.randomUUID();
    @Test void counterStartsAtZeroAndCanBeResetWithoutChangingTickets() {
        assertThat(counters.read(bot)).isEqualTo(new TicketCounterService.Counter(0,false));
        assertThat(counters.reset(bot,42).nextNumber()).isEqualTo(42);
        verify(jdbc).update(anyString(),eq(bot),eq(42));
        assertThatThrownBy(()->counters.reset(bot,-1)).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->counters.reset(bot,100000)).isInstanceOf(StoreValidationException.class);
    }
    @Test void reservationReturnsTheAtomicNumberAndNeverWrapsSilently() {
        when(jdbc.query(anyString(),org.mockito.ArgumentMatchers.<RowMapper<Integer>>any(),eq(bot))).thenReturn(List.of(99999),List.of());
        assertThat(counters.reserve(bot)).isEqualTo(99999);
        assertThatThrownBy(()->counters.reserve(bot)).isInstanceOf(StoreValidationException.class).hasMessageContaining("reset");
    }
    @Test void retentionUsesTheThailandMonthBoundaryIncludingTheUtcPreviousDay() {
        var policy=new TicketHistoryRetention(jdbc);
        policy.purgeAt(Instant.parse("2026-10-31T16:59:59Z"));
        verify(jdbc).update(anyString(),eq(OffsetDateTime.parse("2026-10-01T00:00:00+07:00")));
        policy.purgeAt(Instant.parse("2026-10-31T17:00:00Z"));
        verify(jdbc).update(anyString(),eq(OffsetDateTime.parse("2026-11-01T00:00:00+07:00")));
    }
}
