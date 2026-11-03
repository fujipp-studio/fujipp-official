package com.fujipp.backend.store;

import com.fujipp.backend.auth.CurrentUserService;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
class PriceReaderTestService {
    private final StoreRepository repository;
    private final CurrentUserService users;
    private final StoreSecretCipher cipher;
    private final PriceReaderGeminiClient gemini;
    private final AdminBotRepository adminBots;
    PriceReaderTestService(StoreRepository repository, CurrentUserService users, StoreSecretCipher cipher,
                          PriceReaderGeminiClient gemini, AdminBotRepository adminBots) {
        this.repository=repository; this.users=users; this.cipher=cipher; this.gemini=gemini; this.adminBots=adminBots;
    }
    PriceReaderGeminiClient.Result test(String subject, UUID licenseId, PriceReaderTestController.Request request) {
        return testOwner(users.getActiveAccount(subject).id(), licenseId, request);
    }
    PriceReaderGeminiClient.Result testAdmin(UUID botId, UUID licenseId, PriceReaderTestController.Request request) {
        UUID owner=adminBots.ownerId(botId);
        if (owner==null || !adminBots.licenseInstalledOnBot(licenseId,botId)) throw new StoreNotFoundException("Installed feature license was not found");
        return testOwner(owner,licenseId,request);
    }
    private PriceReaderGeminiClient.Result testOwner(UUID owner, UUID licenseId, PriceReaderTestController.Request request) {
        var license=repository.findLicense(licenseId,owner).orElseThrow(()->new StoreNotFoundException("Feature license was not found"));
        if (!"ACTIVE".equals(license.status()) || license.expiresAt()!=null && !license.expiresAt().isAfter(OffsetDateTime.now()))
            throw new StoreConflictException("Feature license is not active");
        var definitions=repository.findConfigDefinitions(license.versionId());
        var definition=definitions.stream()
            .filter(d->d.secret() && d.key().equals("GEMINI_API_KEY")).findFirst()
            .orElseThrow(()->new StoreValidationException("Upgrade Price Reader to 3.0.0 before using Gemini"));
        String key=request.apiKey();
        if (key==null || key.isBlank()) {
            var saved=repository.findFeatureSecret(license,definition.id());
            if (saved==null) throw new StoreValidationException("Enter a Gemini API key first");
            key=cipher.decrypt(saved.ciphertext(),saved.nonce(),saved.keyVersion());
        }
        key=key.trim();
        if (!key.matches(PriceReaderGeminiClient.KEY_PATTERN)) throw new StoreValidationException("Invalid Gemini API key format");
        String model=request.model();
        if (model==null || !model.matches(PriceReaderGeminiClient.MODEL_PATTERN)) throw new StoreValidationException("Invalid Gemini model name");
        if (request.imageBase64()!=null) {
            if (!List.of("image/png","image/jpeg","image/webp").contains(request.mimeType()==null?"":request.mimeType()))
                throw new StoreValidationException("Choose a PNG, JPEG or WebP image");
            try {
                byte[] bytes=Base64.getDecoder().decode(request.imageBase64());
                if (bytes.length==0 || bytes.length>10*1024*1024) throw new IllegalArgumentException();
            } catch (IllegalArgumentException error) { throw new StoreValidationException("Image must be valid base64 and at most 10 MB"); }
        }
        boolean classified=definitions.stream().anyMatch(d->d.key().equals("PRICE_READER_PRICING_MODE"));
        boolean counted=definitions.stream().anyMatch(d->d.key().equals("PRICE_READER_COUNT_PRICE_RULES"));
        if (counted) return gemini.test(key,model,request.imageBase64(),request.mimeType(),true,true);
        return classified ? gemini.test(key,model,request.imageBase64(),request.mimeType(),true)
            : gemini.test(key,model,request.imageBase64(),request.mimeType());
    }
}
