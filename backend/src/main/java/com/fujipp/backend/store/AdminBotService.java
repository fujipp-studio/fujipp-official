package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeSlotService;
import com.fujipp.backend.runtime.RuntimeService;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.time.OffsetDateTime;
import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.pagination.CursorPage;

@Service
public class AdminBotService {
    private static final Set<String> CORE_FEATURE_CODES = Set.of(
            "bot-permissions",
            "bot-presence",
            "runtime-expiry-alert"
    );

    private final AdminBotRepository repository;
    private final RuntimeSlotService runtimeSlots;
    private final StoreRepository storeRepository;
    private final StoreService storeService;
    private final CursorCodec cursors;
    private final RuntimeService runtime;

    public AdminBotService(AdminBotRepository repository, RuntimeSlotService runtimeSlots,
                           StoreRepository storeRepository,StoreService storeService,CursorCodec cursors,RuntimeService runtime) {
        this.repository = repository;
        this.runtimeSlots = runtimeSlots;
        this.storeRepository=storeRepository;
        this.storeService=storeService;
        this.cursors=cursors;
        this.runtime=runtime;
    }

    public List<AdminStoreResponses.Bot> list(String query) { return repository.findBots(query); }

    @Transactional
    public void delete(UUID botId) {
        if (!repository.decommission(botId)) {
            throw new StoreNotFoundException("Bot was not found");
        }
        repository.detachRuntimeSubscriptions(botId);
        repository.removeFeatureInstallations(botId);
        repository.deleteCredentials(botId);
        runtime.invalidateBootstrap();
    }

    public CursorPage<AdminStoreResponses.Bot> listV2(String query,int limit,String cursor) {
        String filter=query==null?"":query.trim().toLowerCase();
        var values=cursors.decode(cursor,"admin-bots",filter,2);
        OffsetDateTime created=values.isEmpty()?null:cursors.dateTime(values.get(0));
        UUID id=values.isEmpty()?null:cursors.uuid(values.get(1));
        return CursorPage.of(repository.findBotsPage(query,created,id,limit+1),limit,
                item->cursors.encode("admin-bots",filter,List.of(item.createdAt().toString(),item.id().toString())));
    }

    @Transactional
    public AdminStoreResponses.Bot transfer(UUID botId, UUID newOwnerUserId, boolean keepRunning) {
        if (!repository.userExists(newOwnerUserId)) throw new StoreNotFoundException("New bot owner was not found");
        try {
            if (!repository.transfer(botId, newOwnerUserId, keepRunning)) throw new StoreNotFoundException("Bot was not found");
            runtime.invalidateBootstrap();
            return repository.findBot(botId).orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
        } catch (DataAccessException exception) {
            throw new StoreConflictException("Bot transfer conflicts with the target owner's bots or features", exception);
        }
    }

    @Transactional
    public AdminStoreResponses.Bot control(UUID botId, String action) {
        AdminStoreResponses.Bot bot = repository.findBot(botId)
                .orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
        if (!"stop".equals(action)) runtimeSlots.requireRunnable(botId, bot.ownerUserId());
        if (!repository.control(botId, action)) {
            throw new StoreNotFoundException("Controllable bot was not found");
        }
        runtime.invalidateBootstrap();
        return repository.findBot(botId)
                .orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
    }

    public BotResponse settings(UUID botId) {
        return repository.findSettings(botId).orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
    }

    public List<LicenseResponse> licenses(UUID botId) {
        UUID ownerId=repository.ownerId(botId);
        if(ownerId==null)throw new StoreNotFoundException("Bot was not found");
        return storeRepository.findLicenses(ownerId).stream()
                .filter(license->license.installations().stream().anyMatch(i->i.botId().equals(botId))).toList();
    }

    public FeatureConfigurationResponse configuration(UUID botId,UUID licenseId) {
        UUID ownerId=requireLicenseOwner(botId,licenseId);
        return storeService.getConfigurationAsAdmin(licenseId,ownerId);
    }

    public FeatureConfigurationResponse updateConfiguration(UUID botId,UUID licenseId,
                                                              UpdateFeatureConfigurationRequest request) {
        UUID ownerId=requireLicenseOwner(botId,licenseId);
        return storeService.updateConfigurationAsAdmin(licenseId,ownerId,request);
    }

    private UUID requireLicenseOwner(UUID botId,UUID licenseId) {
        UUID ownerId=repository.ownerId(botId);
        if(ownerId==null||!repository.licenseInstalledOnBot(licenseId,botId))
            throw new StoreNotFoundException("Installed feature license was not found");
        return ownerId;
    }

    @Transactional
    public void removeFeature(UUID botId, UUID installationId) {
        if (repository.ownerId(botId) == null) {
            throw new StoreNotFoundException("Bot was not found");
        }
        String featureCode = repository.installedFeatureCode(botId, installationId);
        if (featureCode == null) {
            throw new StoreNotFoundException("Installed feature was not found");
        }
        if (CORE_FEATURE_CODES.contains(featureCode)) {
            throw new StoreConflictException("Core features cannot be removed from a bot");
        }
        if (!repository.removeFeatureInstallation(botId, installationId)) {
            throw new StoreNotFoundException("Installed feature was not found");
        }
        runtime.invalidateBootstrap();
    }

    @Transactional
    public BotResponse updateSettings(UUID botId, UpdateBotRequest request) {
        if (!repository.updateSettings(botId, request)) throw new StoreNotFoundException("Bot was not found");
        runtime.invalidateBootstrap();
        return settings(botId);
    }
}
