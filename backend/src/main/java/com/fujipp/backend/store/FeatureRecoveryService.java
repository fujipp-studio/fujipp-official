package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeService;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class FeatureRecoveryService {
    private final FeatureHealthRepository repository;
    private final RuntimeService runtime;
    FeatureRecoveryService(FeatureHealthRepository repository,RuntimeService runtime) { this.repository=repository;this.runtime=runtime; }

    @Scheduled(fixedDelayString="${app.features.recovery-poll-ms:15000}",initialDelay=30000)
    @Transactional
    public void retryDue() {
        if (repository.retryDue()>0) runtime.invalidateBootstrap();
    }
}
