package com.fujipp.backend.spending;

import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.*;

class MemberSpendingMonthlySettingsTests {
    @Test void startsCyclesOnTheConfiguredDayAndRetainsPreviousMonthBeforeTheBoundary() {
        var settings = new MemberSpendingMonthlySettings(true,25);
        assertThat(settings.period(LocalDate.of(2026,10,24))).isEqualTo(LocalDate.of(2026,9,1));
        assertThat(settings.period(LocalDate.of(2026,10,25))).isEqualTo(LocalDate.of(2026,10,1));
        assertThat(settings.period(LocalDate.of(2026,1,24))).isEqualTo(LocalDate.of(2025,12,1));
    }
    @Test void usesTheLastDayOfShortMonthsIncludingLeapYears() {
        var settings = new MemberSpendingMonthlySettings(true,31);
        assertThat(settings.period(LocalDate.of(2026,2,27))).isEqualTo(LocalDate.of(2026,1,1));
        assertThat(settings.period(LocalDate.of(2026,2,28))).isEqualTo(LocalDate.of(2026,2,1));
        assertThat(settings.period(LocalDate.of(2028,2,28))).isEqualTo(LocalDate.of(2028,1,1));
        assertThat(settings.period(LocalDate.of(2028,2,29))).isEqualTo(LocalDate.of(2028,2,1));
        assertThat(settings.period(LocalDate.of(2028,3,30))).isEqualTo(LocalDate.of(2028,2,1));
        assertThat(settings.period(LocalDate.of(2028,3,31))).isEqualTo(LocalDate.of(2028,3,1));
    }
    @Test void disabledTrackingDoesNotSelectAMonthlyBucket() {
        assertThat(new MemberSpendingMonthlySettings(false,25).period(LocalDate.of(2026,10,26))).isNull();
        for (int day : new int[]{0,32}) assertThatThrownBy(()->new MemberSpendingMonthlySettings(true,day)).isInstanceOf(IllegalArgumentException.class);
    }
}
