package com.fujipp.backend.store;

import com.fujipp.backend.auth.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class TicketHistoryServiceTests {
    private final UUID owner = UUID.randomUUID(), botId = UUID.randomUUID(), installation = UUID.randomUUID();
    private final String guild = "111111111111111111", room = "222222222222222222";
    private final StoreRepository bots = mock(StoreRepository.class);
    private final AdminBotRepository admins = mock(AdminBotRepository.class);
    private final CurrentUserService users = mock(CurrentUserService.class);
    private final StoreSecretCipher cipher = mock(StoreSecretCipher.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final DiscordTicketClient discord = mock(DiscordTicketClient.class);
    private final ObjectMapper json = new ObjectMapper();
    private final TicketHistoryService service = new TicketHistoryService(bots, admins, users, cipher, jdbc, discord, json);

    private void authorize() {
        when(users.getActiveAccount(owner.toString())).thenReturn(new CurrentUserRepository.AccountProfile(owner, AppRole.USER,
            AccountStatus.ACTIVE, "owner", "Owner", null, null, null, null));
        when(bots.findOwnedBot(botId, owner)).thenReturn(Optional.of(new BotResponse(botId, "Bot", null, guild, null, null, "RUNNING", "RUNNING", 0, null, null)));
        byte[] bytes = { 1 };
        when(bots.findBotCredential(botId, owner, "DISCORD_TOKEN")).thenReturn(new StoreRepository.BotCredential(bytes, bytes, "v1"));
        when(cipher.decrypt(bytes, bytes, "v1")).thenReturn("private-test-token");
        when(jdbc.queryForList(anyString(), eq(String.class), eq(botId))).thenReturn(List.of(installation.toString()));
    }
    private JsonNode channel(String installationId, String guildId, String status) {
        var node = json.createObjectNode().put("id", room).put("name", "ticket-order").put("guild_id", guildId).put("type", 0);
        node.put("topic", "fujipp-ticket:" + installationId + ":" + "{\"ownerId\":\"333333333333333333\",\"categoryKey\":\"order\",\"status\":\"" + status + "\",\"openedAt\":1790000000000}");
        return node;
    }
    @Test void ownerAccessIsCheckedBeforeDecryptingOrCallingDiscord() {
        authorize(); when(bots.findOwnedBot(botId, owner)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.list(owner.toString(), botId, false)).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(discord, cipher);
    }
    @Test void onlyThisBotsInstallationMarkersAppearInTheList() {
        authorize();
        when(discord.channels("private-test-token", guild)).thenReturn(json.createArrayNode()
            .add(channel(installation.toString(), guild, "CLOSED"))
            .add(channel(UUID.randomUUID().toString(), guild, "OPEN"))
            .add(json.createObjectNode().put("id", "444444444444444444").put("type", 0).put("topic", "Ordinary channel")));
        var tickets = service.list(owner.toString(), botId, false);
        assertThat(tickets).hasSize(1);
        assertThat(tickets.getFirst().status()).isEqualTo("CLOSED");
        assertThat(json.writeValueAsString(tickets)).doesNotContain("private-test-token", "fujipp-ticket", installation.toString());
    }
    @Test void refusesOtherGuildsAndInstallationsBeforeReadingAnyMessages() {
        authorize();
        for (JsonNode invalid : List.of(channel(installation.toString(), "999999999999999999", "OPEN"), channel(UUID.randomUUID().toString(), guild, "OPEN"))) {
            when(discord.channel("private-test-token", room)).thenReturn(invalid);
            assertThatThrownBy(() -> service.messages(owner.toString(), botId, false, room, null, 50)).isInstanceOf(StoreNotFoundException.class);
        }
        verify(discord, never()).messages(anyString(), anyString(), any(), anyInt());
    }
    @Test void readsClosedTicketPagesChronologicallyAndReturnsAnOlderCursor() {
        authorize(); when(discord.channel("private-test-token", room)).thenReturn(channel(installation.toString(), guild, "CLOSED"));
        JsonNode newer = json.readTree("""
            {"id":"555555555555555555","author":{"id":"333333333333333333","username":"Alice"},
             "timestamp":"2026-10-29T08:00:00Z","content":"Hello"}
            """);
        JsonNode older = json.readTree("""
            {"id":"444444444444444444","author":{"id":"666666666666666666","username":"Support","bot":true},
             "timestamp":"2026-10-29T07:00:00Z","content":"Welcome"}
            """);
        when(discord.messages("private-test-token", room, null, 2)).thenReturn(json.createArrayNode().add(newer).add(older));
        var page = service.messages(owner.toString(), botId, false, room, null, 2);
        assertThat(page.items()).extracting(TicketHistoryService.Message::content).containsExactly("Welcome", "Hello");
        assertThat(page.nextBefore()).isEqualTo("444444444444444444"); assertThat(page.hasMore()).isTrue();
    }
    @Test void extractsFormsEmbedsAttachmentsAndRepliesWithoutUnsafeLinks() {
        var node = json.readTree("""
          {"id":"555555555555555555","author":{"id":"333333333333333333","username":"Alice"},
           "content":"<script>alert(1)</script>","timestamp":"2026-10-29T08:00:00Z",
           "message_reference":{"message_id":"444444444444444444"},
           "embeds":[{"title":"Order","fields":[{"name":"Item","value":"VIP"}]}],
           "components":[{"type":17,"components":[{"type":10,"content":"Form answer"}]}],
           "attachments":[{"filename":"receipt.png","url":"https://cdn.discordapp.com/attachments/1/2/file.png?ex=123"},
             {"filename":"bad","url":"javascript:alert(1)"}]}
          """);
        var message = TicketHistoryService.message(node);
        assertThat(message.blocks()).containsExactly("Order", "Item", "VIP", "Form answer");
        assertThat(message.attachments()).hasSize(1);
        assertThat(message.replyToId()).isEqualTo("444444444444444444");
        assertThat(message.content()).isEqualTo("<script>alert(1)</script>");
        for (String url : List.of("javascript:alert(1)", "https://cdn.discordapp.com.evil.invalid/attachments/a", "https://cdn.discordapp.com@evil.invalid/attachments/a"))
            assertThat(TicketHistoryService.attachmentUrl(url)).isFalse();
    }
    @Test void rejectsUnboundedOrInjectedPaginationBeforeNetworkRequests() {
        for (String id : List.of("../users/@me", "abc", "1?limit=999"))
            assertThatThrownBy(() -> service.messages(owner.toString(), botId, false, id, null, 50)).isInstanceOf(StoreValidationException.class);
        for (int limit : List.of(0, 101))
            assertThatThrownBy(() -> service.messages(owner.toString(), botId, false, room, null, limit)).isInstanceOf(StoreValidationException.class);
        verifyNoInteractions(discord);
    }
    @Test void adminEndpointsCannotBeUsedByAnOrdinaryAccount() {
        authorize();
        assertThatThrownBy(() -> service.list(owner.toString(), botId, true)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        verifyNoInteractions(admins, discord);
    }
    @Test void administratorReadsUsingTheBotsCurrentOwnerCredential() {
        authorize(); UUID admin = UUID.randomUUID();
        when(users.getActiveAccount(admin.toString())).thenReturn(new CurrentUserRepository.AccountProfile(admin,
            AppRole.ADMIN, AccountStatus.ACTIVE, "admin", "Admin", null, null, null, null));
        when(admins.findBot(botId)).thenReturn(Optional.of(new AdminStoreResponses.Bot(botId, owner, "Owner", "Bot", "RUNNING", "RUNNING", null)));
        when(discord.channels("private-test-token", guild)).thenReturn(json.createArrayNode());
        assertThat(service.list(admin.toString(), botId, true)).isEmpty();
        verify(bots).findBotCredential(botId, owner, "DISCORD_TOKEN");
    }
}
