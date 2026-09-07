package com.fujipp.backend.auth;

import com.fujipp.backend.pagination.CursorCodec;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class AdminWalletHistoryTests {
    @Test
    void historyIncludesTheCurrentWalletBalanceWithoutTheLegacyHistoryQuery() {
        var repository = mock(AdminUserRepository.class);
        var service = new AdminUserService(repository, new CursorCodec(new ObjectMapper()));
        UUID customer = UUID.randomUUID(), wallet = UUID.randomUUID();
        when(repository.findWalletSnapshot(customer)).thenReturn(Optional.of(
                new AdminUserResponses.WalletSnapshot(customer, wallet, 12345)));
        when(repository.findWalletHistoryPage(wallet, null, null, 51)).thenReturn(List.of());
        var result = service.getWalletHistoryV2(customer, 50, null);
        assertThat(result.currentBalanceSatang()).isEqualTo(12345);
        assertThat(result.walletId()).isEqualTo(wallet);
        assertThat(result.items()).isEmpty();
        verify(repository, never()).findWalletHistory(any());
        verify(repository, never()).findWalletIdByCustomerId(any());
    }

    @Test
    void viewingAnAccountWithoutAWalletDoesNotCreateFinancialRecords() {
        var repository = mock(AdminUserRepository.class);
        var service = new AdminUserService(repository, new CursorCodec(new ObjectMapper()));
        UUID customer = UUID.randomUUID();
        when(repository.findWalletSnapshot(customer)).thenReturn(Optional.empty());
        var result = service.getWalletHistoryV2(customer, 50, null);
        assertThat(result.items()).isEmpty();
        assertThat(result.hasMore()).isFalse();
        verify(repository).findWalletSnapshot(customer);
        verifyNoMoreInteractions(repository);
    }
}
