package com.fujipp.backend.store;

import com.fujipp.backend.auth.CurrentUserService;
import org.junit.jupiter.api.Test;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PriceReaderTestServiceTests {
    private final StoreRepository repository=mock(StoreRepository.class);
    private final CurrentUserService users=mock(CurrentUserService.class);
    private final StoreSecretCipher cipher=mock(StoreSecretCipher.class);
    private final PriceReaderGeminiClient gemini=mock(PriceReaderGeminiClient.class);
    private final AdminBotRepository bots=mock(AdminBotRepository.class);
    private final PriceReaderTestService service=new PriceReaderTestService(repository,users,cipher,gemini,bots);
    private final UUID bot=UUID.randomUUID(), owner=UUID.randomUUID(), licenseId=UUID.randomUUID(), definition=UUID.randomUUID();
    private final String key="AQ.synthetic-gemini.key-for-tests";
    private final StoreRepository.LicenseContext license=new StoreRepository.LicenseContext(licenseId,UUID.randomUUID(),UUID.randomUUID(),"ACTIVE",null,UUID.randomUUID(),1,bot);
    private PriceReaderTestController.Request request(String key) { return new PriceReaderTestController.Request(key,PriceReaderGeminiClient.DEFAULT_MODEL,null,null); }
    private void authorize() {
        when(bots.ownerId(bot)).thenReturn(owner);
        when(bots.licenseInstalledOnBot(licenseId,bot)).thenReturn(true);
        when(repository.findLicense(licenseId,owner)).thenReturn(Optional.of(license));
        when(repository.findConfigDefinitions(license.versionId())).thenReturn(List.of(new StoreRepository.ConfigDefinition(definition,"GEMINI_API_KEY","SECRET",true)));
    }
    @Test void unrelatedBotOrLicenseCannotProbeStoredCredentials() {
        assertThatThrownBy(()->service.testAdmin(bot,licenseId,request(null))).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(repository,cipher,gemini);
    }
    @Test void ownerLookupUsesTheAuthenticatedAccount() {
        when(users.getActiveAccount("authenticated-subject")).thenReturn(new com.fujipp.backend.auth.CurrentUserRepository.AccountProfile(
            owner,com.fujipp.backend.auth.AppRole.USER,com.fujipp.backend.auth.AccountStatus.ACTIVE,"user","User",null,null,null,null));
        when(repository.findLicense(licenseId,owner)).thenReturn(Optional.empty());
        assertThatThrownBy(()->service.test("authenticated-subject",licenseId,request(key))).isInstanceOf(StoreNotFoundException.class);
        verify(repository).findLicense(licenseId,owner);
        verifyNoInteractions(cipher,gemini);
    }
    @Test void draftKeyIsTestedWithoutSavingOrReadingSavedSecrets() {
        authorize();
        service.testAdmin(bot,licenseId,request(key));
        verify(gemini).test(key,PriceReaderGeminiClient.DEFAULT_MODEL,null,null);
        verify(repository,never()).findFeatureSecret(any(),any());
        verifyNoInteractions(cipher);
        verify(repository,never()).upsertSecret(any(),any(),any());
    }
    @Test void blankDraftUsesEncryptedSavedKeyWithoutReturningIt() {
        authorize();
        byte[] ciphertext={1}, nonce={2};
        when(repository.findFeatureSecret(license,definition)).thenReturn(new StoreRepository.BotCredential(ciphertext,nonce,"v1"));
        when(cipher.decrypt(ciphertext,nonce,"v1")).thenReturn(key);
        service.testAdmin(bot,licenseId,request(""));
        verify(gemini).test(key,PriceReaderGeminiClient.DEFAULT_MODEL,null,null);
    }
    @Test void oldVersionsExpiredLicensesInvalidModelsAndOversizedImagesFailBeforeGoogle() {
        authorize();
        when(repository.findConfigDefinitions(license.versionId())).thenReturn(List.of());
        assertThatThrownBy(()->service.testAdmin(bot,licenseId,request(key))).isInstanceOf(StoreValidationException.class);
        authorize();
        assertThatThrownBy(()->service.testAdmin(bot,licenseId,new PriceReaderTestController.Request(key,"../model",null,null))).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->service.testAdmin(bot,licenseId,new PriceReaderTestController.Request(key,PriceReaderGeminiClient.DEFAULT_MODEL,"invalid-base64!","image/png"))).isInstanceOf(StoreValidationException.class);
        when(repository.findLicense(licenseId,owner)).thenReturn(Optional.of(new StoreRepository.LicenseContext(license.id(),license.productId(),license.versionId(),"ACTIVE",OffsetDateTime.now().minusDays(1),license.configSetId(),1,bot)));
        assertThatThrownBy(()->service.testAdmin(bot,licenseId,request(key))).isInstanceOf(StoreConflictException.class);
        verifyNoInteractions(gemini);
    }
    @Test void previewContractFollowsTheLicensedVersionRatherThanClientInput() {
        authorize();
        when(repository.findConfigDefinitions(license.versionId())).thenReturn(List.of(
            new StoreRepository.ConfigDefinition(definition,"GEMINI_API_KEY","SECRET",true),
            new StoreRepository.ConfigDefinition(UUID.randomUUID(),"PRICE_READER_PRICING_MODE","ENUM",false)));
        service.testAdmin(bot,licenseId,request(key));
        verify(gemini).test(key,PriceReaderGeminiClient.DEFAULT_MODEL,null,null,true);
    }

}
