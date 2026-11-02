package com.fujipp.backend.store;

import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.runtime.RuntimeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
class FeatureHealthService {
    private final FeatureHealthRepository repository;
    private final StoreRepository store;
    private final CurrentUserService users;
    private final RuntimeService runtime;
    private final FeaturePermissionProbe permissions;
    FeatureHealthService(FeatureHealthRepository repository,StoreRepository store,CurrentUserService users,
            RuntimeService runtime,FeaturePermissionProbe permissions) {
        this.repository=repository;this.store=store;this.users=users;this.runtime=runtime;this.permissions=permissions;
    }

    @Transactional(readOnly=true)
    public List<FeatureHealthResponse> list(String subject,UUID botId) {
        authorize(subject,botId);return repository.list(botId).stream().map(FeatureHealthRepository.Row::response).toList();
    }
    @Transactional(readOnly=true)
    public List<FeatureHealthResponse> listAsAdmin(UUID botId) {
        if (!repository.botExists(botId)) throw new StoreNotFoundException("Bot was not found");
        return repository.list(botId).stream().map(FeatureHealthRepository.Row::response).toList();
    }
    @Transactional
    public void retry(String subject,UUID botId,UUID installationId) {
        authorize(subject,botId);retryChecked(botId,installationId);
    }
    @Transactional
    public void retryAsAdmin(UUID botId,UUID installationId) {
        if (!repository.botExists(botId)) throw new StoreNotFoundException("Bot was not found");
        retryChecked(botId,installationId);
    }
    private void retryChecked(UUID botId,UUID installationId) {
        var target=repository.list(botId).stream().filter(row->row.id().equals(installationId)).findFirst()
                .orElseThrow(()->new StoreNotFoundException("Feature installation was not found"));
        if (!target.canRetry()) throw new StoreConflictException("Only a failed startup on a running bot with an active license can be retried; review operation errors separately");
        var license=store.findLicense(target.licenseId(),target.owner()).orElseThrow(()->new StoreNotFoundException("License was not found"));
        var config=FeatureConfigurationChecks.validate(store.findConfiguration(license),Map.of(),Map.of());
        permissions.check(botId,target.guildId(),target.code(),config);
        if (!repository.retry(botId,installationId,target.owner())) throw new StoreConflictException("Feature status changed; refresh and try again");
        runtime.invalidateBootstrap();
    }
    private void authorize(String subject,UUID botId) {
        var owner=users.getActiveAccount(subject).id();
        if (!store.botBelongsTo(botId,owner)) throw new StoreNotFoundException("Bot was not found");
    }
}
