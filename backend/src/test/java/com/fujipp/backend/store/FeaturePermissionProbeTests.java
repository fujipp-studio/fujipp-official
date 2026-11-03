package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.math.BigInteger;
import java.util.Set;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class FeaturePermissionProbeTests {
    private final ObjectMapper json=new ObjectMapper();
    @Test void readsGuildMetadataAndRejectsChannelOverwriteBeforeStartup() {
        var repository=mock(FeatureHealthRepository.class);
        var cipher=mock(StoreSecretCipher.class);
        var discord=mock(FeatureDiscordClient.class);
        var probe=new FeaturePermissionProbe(repository,cipher,discord);
        UUID bot=UUID.randomUUID();String guild="111111111111111111",member="222222222222222222",channel="333333333333333333";
        byte[] encrypted={1},nonce={2};
        when(repository.credential(bot)).thenReturn(Optional.of(new FeatureHealthRepository.Credential(encrypted,nonce,"v1")));
        when(cipher.decrypt(encrypted,nonce,"v1")).thenReturn("synthetic-token");
        when(discord.get("synthetic-token","/users/@me")).thenReturn(json.readTree("{\"id\":\""+member+"\"}"));
        when(discord.get("synthetic-token","/guilds/"+guild+"/members/"+member)).thenReturn(json.readTree("{\"roles\":[]}"));
        when(discord.get("synthetic-token","/guilds/"+guild+"/roles")).thenReturn(json.readTree("[{\"id\":\""+guild+"\",\"permissions\":\"84992\"}]"));
        when(discord.get("synthetic-token","/guilds/"+guild+"/channels")).thenReturn(json.readTree("[{\"id\":\""+channel+"\",\"guild_id\":\""+guild+"\",\"type\":0,\"permission_overwrites\":[{\"id\":\""+guild+"\",\"type\":0,\"deny\":\"1024\",\"allow\":\"0\"}]}]"));
        assertThatThrownBy(()->probe.check(bot,guild,"price-reader",Map.of("PRICE_READER_CHANNEL_ID",json.valueToTree(channel))))
            .isInstanceOf(StoreValidationException.class).hasMessageContaining("สิทธิ์");
        verify(discord).get("synthetic-token","/guilds/"+guild+"/channels");
        verify(discord).get("synthetic-token","/users/@me");
        verify(discord).get("synthetic-token","/guilds/"+guild+"/members/"+member);
        verify(discord).get("synthetic-token","/guilds/"+guild+"/roles");
        verifyNoMoreInteractions(discord);
    }
    @Test void appliesEveryoneThenCombinedRolesThenMemberOverwrite() {
        var overwrites=json.readTree("""
            [{"id":"guild","type":0,"deny":"2048","allow":"0"},
             {"id":"role-a","type":0,"deny":"0","allow":"2048"},
             {"id":"role-b","type":0,"deny":"2048","allow":"0"},
             {"id":"member","type":1,"deny":"2048","allow":"65536"}]
            """);
        var result=FeaturePermissionProbe.effectivePermissions(BigInteger.valueOf(1024|2048),overwrites,"guild","member",Set.of("guild","role-a","role-b"));
        assertThat(result).isEqualTo(BigInteger.valueOf(1024|65536));
        var rolesOnly=FeaturePermissionProbe.effectivePermissions(BigInteger.valueOf(1024),overwrites,"guild","other",Set.of("guild","role-a","role-b"));
        assertThat(rolesOnly.testBit(11)).isTrue();
    }
    @Test void administratorBypassesOverwritesAndHighBitsArePreserved() {
        var deny=json.readTree("[{\"id\":\"guild\",\"deny\":\"1099511627775\",\"allow\":\"0\"}]");
        assertThat(FeaturePermissionProbe.effectivePermissions(BigInteger.valueOf(8),deny,"guild","member",Set.of()).testBit(38)).isTrue();
        assertThat(FeaturePermissionProbe.effectivePermissions(BigInteger.ONE.shiftLeft(38),json.readTree("[]"),"guild","member",Set.of()).testBit(38)).isTrue();
    }
}
