package com.fujipp.backend.spending;

import java.time.LocalDate;
import java.time.YearMonth;

public record MemberSpendingMonthlySettings(boolean enabled, int startDay) {
    public MemberSpendingMonthlySettings {
        if (startDay < 1 || startDay > 31) throw new IllegalArgumentException("Monthly start day must be between 1 and 31");
    }

    public LocalDate period(LocalDate today) {
        if (!enabled) return null;
        YearMonth month = YearMonth.from(today);
        LocalDate boundary = month.atDay(Math.min(startDay, month.lengthOfMonth()));
        return (today.isBefore(boundary) ? month.minusMonths(1) : month).atDay(1);
    }
}
