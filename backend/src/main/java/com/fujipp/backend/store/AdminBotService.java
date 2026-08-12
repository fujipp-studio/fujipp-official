package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeSlotService;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class AdminBotService {
    private final AdminBotRepository repository;
    private final RuntimeSlotService runtimeSlots;
    private final StoreRepository storeRepository;
    private final StoreService storeService;

    public AdminBotService(AdminBotRepository repository, RuntimeSlotService runtimeSlots,
                           StoreRepository storeRepository,StoreService storeService) {
        this.repository = repository;
        this.runtimeSlots = runtimeSlots;
        this.storeRepository=storeRepository;
        this.storeService=storeService;
    }

    public List<AdminStoreResponses.Bot> list(String query) { return repository.findBots(query); }

    @Transactional
    public AdminStoreResponses.Bot transfer(UUID botId, UUID newOwnerUserId) {
        if (!repository.userExists(newOwnerUserId)) throw new StoreNotFoundException("New bot owner was not found");
        try {
            if (!repository.transfer(botId, newOwnerUserId)) throw new StoreNotFoundException("Bot was not found");
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
    public BotResponse updateSettings(UUID botId, UpdateBotRequest request) {
        if (!repository.updateSettings(botId, request)) throw new StoreNotFoundException("Bot was not found");
        return settings(botId);
    }
}
