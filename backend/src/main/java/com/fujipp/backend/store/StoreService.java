package com.fujipp.backend.store;

import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.runtime.RuntimeSlotService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class StoreService {

    private static final int MAX_CONFIG_JSON_CHARS = 262_144;

    private final StoreRepository repository;
    private final CurrentUserService currentUserService;
    private final StoreSecretCipher secretCipher;
    private final RuntimeSlotService runtimeSlots;
    private final DiscordBotProfileClient discordProfiles;

    public StoreService(
            StoreRepository repository,
            CurrentUserService currentUserService,
            StoreSecretCipher secretCipher,
            RuntimeSlotService runtimeSlots,
            DiscordBotProfileClient discordProfiles
    ) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.secretCipher = secretCipher;
        this.runtimeSlots = runtimeSlots;
        this.discordProfiles = discordProfiles;
    }

    @Transactional(readOnly = true)
    public List<FeatureSummaryResponse> listFeatures() {
        return repository.findActiveFeatures();
    }

    @Transactional(readOnly = true)
    public List<BotResponse> listBots(String subject) {
        return repository.findBots(activeUser(subject).id());
    }

    @Transactional
    public BotResponse createBot(String subject, CreateBotRequest request) {
        UUID userId = activeUser(subject).id();
        try {
            return repository.createBot(
                    userId,
                    request.name().trim(),
                    normalize(request.discordApplicationId()),
                    normalize(request.discordGuildId())
            );
        } catch (DataIntegrityViolationException exception) {
            throw new StoreConflictException("Bot name or Discord application is already in use", exception);
        }
    }

    @Transactional
    public BotResponse updateBot(String subject, UUID botId, UpdateBotRequest request) {
        UUID userId = activeUser(subject).id();
        try {
            return repository.updateBot(botId, userId, request.name().trim(),
                    normalize(request.discordApplicationId()), normalize(request.discordGuildId()));
        } catch (DataIntegrityViolationException exception) {
            throw new StoreConflictException("Bot name or Discord application is already in use", exception);
        }
    }

    @Transactional
    public BotResponse controlBot(String subject, UUID botId, String action) {
        UUID ownerId = activeUser(subject).id();
        if (!"stop".equals(action)) runtimeSlots.requireRunnable(botId, ownerId);
        return repository.controlBot(botId, ownerId, action);
    }

    @Transactional
    public BotResponse updateDiscordToken(
            String subject,
            UUID botId,
            UpdateDiscordTokenRequest request
    ) {
        UUID userId = activeUser(subject).id();
        if (!repository.botBelongsTo(botId, userId)) {
            throw new StoreNotFoundException("Bot was not found");
        }
        String token = request.token().trim();
        repository.upsertBotCredential(
                botId,
                userId,
                "DISCORD_TOKEN",
                secretCipher.encrypt(token)
        );
        return syncDiscordProfile(userId, botId, token);
    }

    @Transactional
    public BotResponse syncDiscordProfile(String subject, UUID botId) {
        UUID userId = activeUser(subject).id();
        StoreRepository.BotCredential credential = repository.findBotCredential(
                botId, userId, "DISCORD_TOKEN"
        );
        if (credential == null) throw new StoreValidationException("Discord token is not configured");
        String token = secretCipher.decrypt(
                credential.ciphertext(), credential.nonce(), credential.keyVersion()
        );
        return syncDiscordProfile(userId, botId, token);
    }

    private BotResponse syncDiscordProfile(UUID userId, UUID botId, String token) {
        try {
            DiscordBotProfileClient.Profile profile = discordProfiles.fetch(token);
            return repository.updateDiscordProfile(
                    botId, userId, profile.username(), profile.avatarUrl()
            );
        } catch (StoreValidationException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new StoreValidationException("Unable to load the bot profile from Discord");
        }
    }

    @Transactional
    public OrderResponse checkout(String subject, CheckoutRequest request) {
        UUID userId = activeUser(subject).id();
        String idempotencyKey = request.idempotencyKey().trim();

        repository.lockCheckout(idempotencyKey);

        StoreRepository.OrderReplay existing = repository
                .findOrderByIdempotency(userId, idempotencyKey)
                .orElse(null);
        if (existing != null) {
            if (!existing.offerId().equals(request.offerId())
                    || existing.quantity() != request.quantity()) {
                throw new StoreConflictException(
                        "Idempotency key was already used for a different checkout"
                );
            }
            return existing.response();
        }

        StoreRepository.OfferCheckoutRow offer = repository.findOfferForCheckout(request.offerId())
                .orElseThrow(() -> new StoreNotFoundException("Feature offer was not found"));

        try {
            StoreRepository.OrderContext order = repository.createPendingOrder(
                    userId,
                    offer,
                    request.quantity(),
                    idempotencyKey
            );
            UUID walletEntryId = repository.debitOrder(order, idempotencyKey);
            OffsetDateTime paidAt = repository.markOrderPaid(order.orderId(), walletEntryId);
            List<UUID> licenseIds = repository.issueLicenses(
                    userId,
                    offer,
                    order,
                    request.quantity(),
                    paidAt
            );
            return new OrderResponse(
                    order.orderId(),
                    order.orderNumber(),
                    "PAID",
                    order.totalSatang(),
                    offer.currency(),
                    paidAt,
                    licenseIds
            );
        } catch (DataAccessException | ArithmeticException exception) {
            throw new StoreConflictException("Checkout could not be completed", exception);
        }
    }

    @Transactional(readOnly = true)
    public List<LicenseResponse> listLicenses(String subject) {
        return repository.findLicenses(activeUser(subject).id());
    }

    @Transactional
    public UUID install(String subject, UUID licenseId, InstallFeatureRequest request) {
        UUID userId = activeUser(subject).id();
        StoreRepository.LicenseContext license = ownedLicense(licenseId, userId);
        if (!repository.botBelongsTo(request.botId(), userId)) {
            throw new StoreNotFoundException("Bot was not found");
        }
        ensureLicenseActive(license);
        try {
            UUID installationId = repository.installFeature(license, userId, request.botId());
            repository.clearConfigValidation(license.configSetId());
            return installationId;
        } catch (DataIntegrityViolationException exception) {
            throw new StoreConflictException(
                    "Feature is already installed or its installation limit was reached",
                    exception
            );
        }
    }

    @Transactional
    public void removeInstallation(String subject, UUID installationId) {
        UUID userId = activeUser(subject).id();
        if (!repository.removeInstallation(installationId, userId)) {
            throw new StoreNotFoundException("Active feature installation was not found");
        }
    }

    @Transactional(readOnly = true)
    public FeatureConfigurationResponse getConfiguration(String subject, UUID licenseId) {
        UUID userId = activeUser(subject).id();
        return repository.findConfiguration(ownedLicense(licenseId, userId));
    }

    @Transactional
    public FeatureConfigurationResponse updateConfiguration(
            String subject,
            UUID licenseId,
            UpdateFeatureConfigurationRequest request
    ) {
        UUID userId = activeUser(subject).id();
        StoreRepository.LicenseContext license = ownedLicense(licenseId, userId);
        ensureLicenseActive(license);
        validateConfigurationSize(request);

        Map<String, StoreRepository.ConfigDefinition> definitions = new LinkedHashMap<>();
        for (StoreRepository.ConfigDefinition definition
                : repository.findConfigDefinitions(license.versionId())) {
            definitions.put(definition.key(), definition);
        }

        for (Map.Entry<String, JsonNode> entry : request.values().entrySet()) {
            StoreRepository.ConfigDefinition definition = requireDefinition(definitions, entry.getKey());
            if (definition.secret()) {
                throw new StoreValidationException(
                        "Secret field must be submitted through secrets: " + entry.getKey()
                );
            }
            if (entry.getValue() == null || entry.getValue().isNull()) {
                throw new StoreValidationException("Config values cannot be null: " + entry.getKey());
            }
            validateValueType(definition, entry.getValue());
            repository.upsertConfigValue(license, definition.id(), entry.getValue());
        }

        for (Map.Entry<String, String> entry : request.secrets().entrySet()) {
            StoreRepository.ConfigDefinition definition = requireDefinition(definitions, entry.getKey());
            if (!definition.secret()) {
                throw new StoreValidationException(
                        "Normal field cannot be submitted through secrets: " + entry.getKey()
                );
            }
            repository.upsertSecret(
                    license,
                    definition.id(),
                    secretCipher.encrypt(entry.getValue())
            );
        }

        Map<String, UUID> slots = repository.findPresentationSlots(license.versionId());
        for (Map.Entry<String, JsonNode> entry : request.presentations().entrySet()) {
            UUID slotId = slots.get(entry.getKey());
            if (slotId == null) {
                throw new StoreValidationException("Unknown presentation slot: " + entry.getKey());
            }
            JsonNode definition = entry.getValue();
            if (definition == null || !definition.isObject()) {
                throw new StoreValidationException(
                        "Presentation definitions must be JSON objects: " + entry.getKey()
                );
            }
            repository.upsertPresentation(license, slotId, definition);
        }

        if (!request.values().isEmpty()
                || !request.secrets().isEmpty()
                || !request.presentations().isEmpty()) {
            repository.bumpConfigRevision(license.configSetId());
        }
        StoreRepository.LicenseContext refreshed = ownedLicense(licenseId, userId);
        return repository.findConfiguration(refreshed);
    }

    private void validateConfigurationSize(UpdateFeatureConfigurationRequest request) {
        long size = request.values().values().stream().mapToLong(this::jsonLength).sum()
                + request.presentations().values().stream().mapToLong(this::jsonLength).sum()
                + request.secrets().values().stream().mapToLong(String::length).sum();
        if (size > MAX_CONFIG_JSON_CHARS) {
            throw new StoreValidationException("Feature configuration is too large");
        }
    }

    private long jsonLength(JsonNode value) {
        return value == null ? 4 : value.toString().length();
    }

    private CurrentUserRepository.AccountProfile activeUser(String subject) {
        return currentUserService.getActiveAccount(subject);
    }

    private StoreRepository.LicenseContext ownedLicense(UUID licenseId, UUID userId) {
        return repository.findLicense(licenseId, userId)
                .orElseThrow(() -> new StoreNotFoundException("Feature license was not found"));
    }

    private void ensureLicenseActive(StoreRepository.LicenseContext license) {
        if (!"ACTIVE".equals(license.status())
                || (license.expiresAt() != null
                && !license.expiresAt().isAfter(OffsetDateTime.now()))) {
            throw new StoreConflictException("Feature license is not active");
        }
    }

    private StoreRepository.ConfigDefinition requireDefinition(
            Map<String, StoreRepository.ConfigDefinition> definitions,
            String key
    ) {
        String normalized = key == null ? "" : key.trim().toUpperCase(Locale.ROOT);
        StoreRepository.ConfigDefinition definition = definitions.get(normalized);
        if (definition == null) {
            throw new StoreValidationException("Unknown feature config key: " + key);
        }
        return definition;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private void validateValueType(
            StoreRepository.ConfigDefinition definition,
            JsonNode value
    ) {
        boolean valid = switch (definition.valueType()) {
            case "STRING", "TEXT", "CHANNEL_ID", "ROLE_ID", "USER_ID", "ENUM" ->
                    value.isTextual();
            case "INTEGER" -> value.isIntegralNumber();
            case "DECIMAL" -> value.isNumber();
            case "BOOLEAN" -> value.isBoolean();
            case "STRING_LIST" -> value.isArray()
                    && java.util.stream.StreamSupport.stream(value.spliterator(), false)
                    .allMatch(JsonNode::isTextual);
            case "JSON" -> true;
            case "SECRET" -> false;
            default -> false;
        };
        if (!valid) {
            throw new StoreValidationException(
                    "Config value has the wrong type for " + definition.key()
            );
        }
    }
}
