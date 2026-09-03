package com.fujipp.backend.donation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DonationServiceTests {
    @Mock DonationRepository repository;
    private DonationService service;
    private UUID userId;

    @BeforeEach
    void setUp() {
        service = new DonationService(repository, 1000, 10000000);
        userId = UUID.randomUUID();
    }

    @Test
    void donatesFromTheAuthenticatedUsersWallet() {
        DonationRepository.Donation donation = donation("Supporter", false, "WALLET", "SUCCESS", 5000, 7000);
        when(repository.create(
                eq(userId),
                eq("Supporter"),
                eq("Keep going"),
                eq(false),
                eq(5000L),
                eq(DonationRequests.FundingMethod.WALLET),
                eq("donation:test-1")
        )).thenReturn(donation);

        DonationResponses.Donation response = service.create(userId.toString(), new DonationRequests.Create(
                5000,
                " Supporter ",
                " Keep going ",
                false,
                DonationRequests.FundingMethod.WALLET,
                "donation:test-1"
        ));

        assertEquals("SUCCESS", response.status());
        assertEquals(7000, response.balanceSatang());
        assertEquals("WALLET", response.fundingMethod());
    }

    @Test
    void createsAnAnonymousDonationAwaitingTheExistingTopupFlow() {
        DonationRepository.Donation donation = donation("Anonymous", true, "TOPUP", "PENDING", 1000, 2000);
        when(repository.create(
                eq(userId), eq("Anonymous"), isNull(), eq(true), eq(1000L),
                eq(DonationRequests.FundingMethod.TOPUP), eq("donation:test-2")
        )).thenReturn(donation);

        DonationResponses.Donation response = service.create(userId.toString(), new DonationRequests.Create(
                1000,
                "",
                "",
                true,
                DonationRequests.FundingMethod.TOPUP,
                "donation:test-2"
        ));

        assertEquals("Anonymous", response.donorName());
        assertEquals("PENDING", response.status());
    }

    @Test
    void ranksOnlySuccessfulWalletDonationsReturnedByTheRepository() {
        OffsetDateTime now = OffsetDateTime.now();
        when(repository.campaign()).thenReturn(new DonationRepository.Campaign(
                "Support Fujipp", "Development", 100000, 30000, 1, now
        ));
        when(repository.leaderboard(10)).thenReturn(List.of(
                new DonationRepository.LeaderboardEntry("Supporter", 30000, 2, now)
        ));

        DonationResponses.Campaign response = service.campaign();

        assertEquals(30000, response.raisedSatang());
        assertEquals(1, response.leaderboard().getFirst().rank());
        assertEquals(2, response.leaderboard().getFirst().donationCount());
    }

    @Test
    void rejectsDonationOutsideTheConfiguredRange() {
        DonationException exception = assertThrows(
                DonationException.class,
                () -> service.create(userId.toString(), new DonationRequests.Create(
                        999,
                        "Supporter",
                        "",
                        false,
                        DonationRequests.FundingMethod.WALLET,
                        "donation:test-3"
                ))
        );

        assertEquals("INVALID_DONATION_AMOUNT", exception.code());
    }

    private DonationRepository.Donation donation(
            String donorName,
            boolean anonymous,
            String fundingMethod,
            String status,
            long amountSatang,
            long balanceSatang
    ) {
        return new DonationRepository.Donation(
                UUID.randomUUID(),
                "DON_TEST",
                userId,
                donorName,
                null,
                anonymous,
                amountSatang,
                "THB",
                fundingMethod,
                status,
                balanceSatang,
                "SUCCESS".equals(status) ? OffsetDateTime.now() : null,
                OffsetDateTime.now()
        );
    }
}
