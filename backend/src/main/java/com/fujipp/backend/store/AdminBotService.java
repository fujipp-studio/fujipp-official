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

    public AdminBotService(AdminBotRepository repository, RuntimeSlotService runtimeSlots) {
        this.repository = repository;
        this.runtimeSlots = runtimeSlots;
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

    @Transactional
    public BotResponse updateSettings(UUID botId, UpdateBotRequest request) {
        if (!repository.updateSettings(botId, request)) throw new StoreNotFoundException("Bot was not found");
        return settings(botId);
    }
}
