package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StoreSecretCipherTests {

    @Test
    void encryptsSecretsWithRandomNoncesAndStableKeyedFingerprints() {
        String key = Base64.getEncoder().encodeToString(new byte[32]);
        StoreSecretCipher cipher = new StoreSecretCipher(key, "test-v1");

        StoreRepository.EncryptedSecret first = cipher.encrypt("secret-value");
        StoreRepository.EncryptedSecret second = cipher.encrypt("secret-value");

        assertThat(first.keyVersion()).isEqualTo("test-v1");
        assertThat(first.nonce()).hasSize(12).isNotEqualTo(second.nonce());
        assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        assertThat(first.fingerprint()).isEqualTo(second.fingerprint());
    }

    @Test
    void refusesSecretWritesWithoutAConfiguredKey() {
        StoreSecretCipher cipher = new StoreSecretCipher("", "v1");

        assertThatThrownBy(() -> cipher.encrypt("secret-value"))
                .isInstanceOf(StoreConflictException.class);
    }
}
