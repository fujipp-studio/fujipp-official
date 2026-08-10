package com.fujipp.backend.auth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.time.OffsetDateTime;
import com.fujipp.backend.store.StoreNotFoundException;
import com.fujipp.backend.store.StoreValidationException;

@Service
public class AdminUserService {
    private final AdminUserRepository repository;

    public AdminUserService(AdminUserRepository repository) {
        this.repository = repository;
    }

    public List<AdminUserResponses.UserSummary> listUsers(String query) {
        return repository.searchUsers(query);
    }

    @Transactional
    public void adjustWallet(UUID customerId, AdminUserRequests.AdjustWalletRequest request, String adminUserId) {
        String direction=request.direction().toUpperCase();
        String entryType=request.entryType().toUpperCase();
        if(!List.of("CREDIT","DEBIT").contains(direction)) throw new StoreValidationException("direction must be CREDIT or DEBIT");
        if(!List.of("ADJUSTMENT","BONUS","REFUND","TOP_UP","PURCHASE").contains(entryType)) throw new StoreValidationException("Invalid wallet entry type");
        UUID walletId = repository.findWalletIdByCustomerId(customerId)
                .orElseThrow(() -> new StoreNotFoundException("Customer wallet was not found"));

        String idempotencyKey = request.idempotencyKey().trim();

        UUID adminUuid = null;
        try {
            if (adminUserId != null) adminUuid = UUID.fromString(adminUserId);
        } catch (IllegalArgumentException ignored) {}

        repository.adjustWallet(
                walletId,
                direction,
                entryType,
                request.amountSatang(),
                request.description(),
                idempotencyKey,
                adminUuid
        );
    }

    public AdminUserResponses.WalletHistoryResponse getWalletHistory(UUID customerId) {
        UUID walletId = repository.findWalletIdByCustomerId(customerId)
                .orElseThrow(() -> new StoreNotFoundException("Customer wallet was not found"));

        List<AdminUserResponses.WalletHistoryEntry> entries = repository.findWalletHistory(walletId);
        long currentBalance = entries.isEmpty() ? 0 : entries.get(0).balanceAfterSatang();

        return new AdminUserResponses.WalletHistoryResponse(customerId, walletId, currentBalance, entries);
    }

    @Transactional
    public AdminUserResponses.UserSummary updateAccount(UUID userId, AdminUserRequests.UpdateAccountRequest request) {
        String role=request.role().toUpperCase(), status=request.status().toUpperCase();
        if (!List.of("USER","TESTER","EDITOR","ADMIN").contains(role)) throw new StoreValidationException("Invalid account role");
        if (!List.of("ACTIVE","SUSPENDED","BANNED","DEACTIVATED").contains(status)) throw new StoreValidationException("Invalid account status");
        if (!repository.updateAccount(userId,role,status,request)) throw new StoreNotFoundException("User was not found");
        return repository.findUser(userId).orElseThrow(()->new StoreNotFoundException("User was not found"));
    }

    public List<AdminUserResponses.FeatureLicense> features(UUID userId){return repository.findFeatureLicenses(userId);}

    @Transactional
    public AdminUserResponses.FeatureLicense grantFeature(UUID userId, AdminUserRequests.GrantFeatureRequest request, String adminSubject) {
        if(request.expiresAt()!=null&&!request.expiresAt().isAfter(OffsetDateTime.now())) throw new StoreValidationException("expiresAt must be in the future");
        UUID adminId=parseUuid(adminSubject);
        UUID id=repository.grantFeature(userId,request,adminId);
        return repository.findFeatureLicense(userId,id).orElseThrow(()->new StoreNotFoundException("Feature or user was not found"));
    }

    @Transactional
    public AdminUserResponses.FeatureLicense updateFeature(UUID userId,UUID licenseId,AdminUserRequests.UpdateFeatureLicenseRequest request){
        String status=request.status().toUpperCase();
        if(!List.of("ACTIVE","SUSPENDED","REVOKED","EXPIRED").contains(status)) throw new StoreValidationException("Invalid feature license status");
        if(!repository.updateFeatureLicense(userId,licenseId,status,request)) throw new StoreNotFoundException("Feature license was not found");
        return repository.findFeatureLicense(userId,licenseId).orElseThrow();
    }

    private UUID parseUuid(String value){try{return value==null?null:UUID.fromString(value);}catch(IllegalArgumentException ignored){return null;}}
}
