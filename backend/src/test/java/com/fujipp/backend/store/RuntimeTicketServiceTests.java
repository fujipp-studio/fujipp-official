package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class RuntimeTicketServiceTests {
    private final UUID bot=UUID.randomUUID(), installation=UUID.randomUUID(), owner=UUID.randomUUID();
    private final String channel="111111111111111111",guild="222222222222222222";
    private final TicketRecordRepository records=mock(TicketRecordRepository.class);
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final StoreRepository bots=mock(StoreRepository.class);
    private final StoreSecretCipher cipher=mock(StoreSecretCipher.class);
    private final DiscordTicketClient discord=mock(DiscordTicketClient.class);
    private final ObjectMapper json=new ObjectMapper();
    private final RuntimeTicketService service=new RuntimeTicketService(records,jdbc,bots,cipher,discord,json,mock(TicketCounterService.class));
    private JsonNode state(String status) {
        return json.readTree("""
            {"ownerId":"333333333333333333","categoryKey":"order","status":"STATUS","openedAt":1790000000000,
             "autoCloseMinutes":0,"autoCloseMode":"IDLE","supportRoleIds":[]}
            """.replace("STATUS",status));
    }
    private void authorize() {
        when(jdbc.query(anyString(),org.mockito.ArgumentMatchers.<RowMapper<RuntimeTicketService.Installation>>any(),eq(bot),eq(installation)))
            .thenReturn(List.of(new RuntimeTicketService.Installation(owner,guild)));
    }
    @Test void participantStateRemainsOptionalAndValidatesEveryMember() {
        assertThatCode(()->RuntimeTicketService.validateState(state("OPEN"))).doesNotThrowAnyException();
        var valid=json.createObjectNode().setAll((tools.jackson.databind.node.ObjectNode)state("OPEN"));
        valid.putArray("participantIds").add("444444444444444444");
        assertThatCode(()->RuntimeTicketService.validateState(valid)).doesNotThrowAnyException();
        for(String raw:List.of("null","{}","[123]","[\"bad-id\"]","[\"444444444444444444\",\"444444444444444444\"]")) {
            valid.set("participantIds",json.readTree(raw));
            assertThatThrownBy(()->RuntimeTicketService.validateState(valid)).isInstanceOf(StoreValidationException.class);
        }
        var excessive=valid.putArray("participantIds");
        for(int i=0;i<26;i++) excessive.add(Long.toString(444444444444444444L+i));
        assertThatThrownBy(()->RuntimeTicketService.validateState(valid)).isInstanceOf(StoreValidationException.class);
    }
    @Test void refusesUnrelatedInstallationsBeforeTouchingAnyTicket() {
        assertThatThrownBy(()->service.nextNumber(bot,installation)).isInstanceOf(StoreNotFoundException.class);
        assertThatThrownBy(()->service.list(bot,installation)).isInstanceOf(StoreNotFoundException.class);
        assertThatThrownBy(()->service.archive(bot,installation,channel,json.createArrayNode())).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(records,discord,cipher,bots);
    }
    @Test void firstRegistrationChecksTheActualGuildBeforeWriting() {
        authorize(); byte[] bytes={1};
        when(bots.findBotCredential(bot,owner,"DISCORD_TOKEN")).thenReturn(new StoreRepository.BotCredential(bytes,bytes,"v1"));
        when(cipher.decrypt(bytes,bytes,"v1")).thenReturn("token");
        when(discord.channel("token",channel)).thenReturn(json.createObjectNode().put("type",0).put("guild_id","999999999999999999"));
        assertThatThrownBy(()->service.save(bot,installation,channel,"ticket",state("OPEN"))).isInstanceOf(StoreNotFoundException.class);
        verify(records,never()).save(any(),any(),any(),any(),any());
        when(discord.channel("token",channel)).thenReturn(json.createObjectNode().put("type",0).put("guild_id",guild));
        service.save(bot,installation,channel,"ticket",state("OPEN"));
        verify(records).save(bot,installation,channel,"ticket",state("OPEN"));
    }
    @Test void refusesClosedStateUntilTheConversationIsArchived() {
        authorize();
        when(records.find(bot,channel)).thenReturn(Optional.of(new TicketRecordRepository.Entry(installation,channel,"ticket",state("CLOSING"),null,false)));
        assertThatThrownBy(()->service.save(bot,installation,channel,"ticket",state("CLOSED"))).isInstanceOf(StoreValidationException.class).hasMessageContaining("Archive");
        verify(records,never()).save(any(),any(),any(),any(),any());
    }
    @Test void sanitizesArchiveAttachmentsAndRejectsDuplicateOrInvalidMessages() {
        authorize();
        JsonNode raw=json.readTree("""
            [{"id":"444444444444444444","author":{"id":"333333333333333333","username":"Alice"},
              "timestamp":"2026-10-29T00:00:00Z","content":"Saved message",
              "attachments":[{"filename":"unsafe","url":"javascript:alert(1)"}]}]
            """);
        service.archive(bot,installation,channel,raw);
        var capture=org.mockito.ArgumentCaptor.forClass(JsonNode.class);
        verify(records).archive(eq(bot),eq(installation),eq(channel),capture.capture());
        assertThat(capture.getValue().get(0).path("attachments").isEmpty()).isTrue();
        var duplicate=json.createArrayNode().add(raw.get(0)).add(raw.get(0));
        assertThatThrownBy(()->service.archive(bot,installation,channel,duplicate)).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->service.archive(bot,installation,"../channels",raw)).isInstanceOf(StoreValidationException.class);
    }
}
