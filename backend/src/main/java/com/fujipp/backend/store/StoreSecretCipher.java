package com.fujipp.backend.store;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class StoreSecretCipher {

    private static final int NONCE_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private final String encodedKey;
    private final String keyVersion;
    private final SecureRandom secureRandom = new SecureRandom();

    public StoreSecretCipher(
            @Value("${app.store.secret-key-base64:}") String encodedKey,
            @Value("${app.store.secret-key-version:v1}") String keyVersion
    ) {
        this.encodedKey = encodedKey;
        this.keyVersion = keyVersion;
    }

    public StoreRepository.EncryptedSecret encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            throw new StoreValidationException("Secret values cannot be blank");
        }

        byte[] key = decodeKey();
        byte[] nonce = new byte[NONCE_BYTES];
        secureRandom.nextBytes(nonce);

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.ENCRYPT_MODE,
                    new SecretKeySpec(key, "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce)
            );
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] fingerprint = hmac.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            return new StoreRepository.EncryptedSecret(
                    ciphertext,
                    nonce,
                    keyVersion,
                    fingerprint
            );
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Feature secret encryption failed", exception);
        }
    }

    public String decrypt(byte[] ciphertext, byte[] nonce, String encryptionKeyVersion) {
        if (!keyVersion.equals(encryptionKeyVersion)) {
            throw new StoreConflictException("Unsupported secret encryption key version");
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    Cipher.DECRYPT_MODE,
                    new SecretKeySpec(decodeKey(), "AES"),
                    new GCMParameterSpec(GCM_TAG_BITS, nonce)
            );
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException exception) {
            throw new StoreConflictException("Stored secret could not be decrypted", exception);
        }
    }

    private byte[] decodeKey() {
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new StoreConflictException("Feature secret encryption is not configured");
        }
        try {
            byte[] key = Base64.getDecoder().decode(encodedKey);
            if (key.length != 32) {
                throw new StoreConflictException("Feature secret encryption key must be 32 bytes");
            }
            return key;
        } catch (IllegalArgumentException exception) {
            throw new StoreConflictException("Feature secret encryption key is invalid", exception);
        }
    }
}
