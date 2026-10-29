package com.fujipp.backend.store;

import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.auth.AppRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.regex.Pattern;

@Service
class TicketHistoryService {
    private final StoreRepository bots;
    private final AdminBotRepository adminBots;
    private final CurrentUserService users;
    private final StoreSecretCipher cipher;
    private final JdbcTemplate jdbc;
    private final DiscordTicketClient discord;
    private final ObjectMapper json;
    private final TicketRecordRepository records;
    private static final Pattern MARKER = Pattern.compile("^fujipp-ticket:([0-9a-fA-F-]{36}):(\\{.*})$");

    TicketHistoryService(StoreRepository bots, AdminBotRepository adminBots, CurrentUserService users,
                         StoreSecretCipher cipher, JdbcTemplate jdbc, DiscordTicketClient discord, ObjectMapper json, TicketRecordRepository records) {
        this.bots=bots; this.adminBots=adminBots; this.users=users; this.cipher=cipher;
        this.jdbc=jdbc; this.discord=discord; this.json=json;
        this.records=records;
    }
    record Ticket(String channelId, String name, String categoryKey, String ownerId, String status, long openedAt, boolean archived) {}
    record Attachment(String name, String url) {}
    record Message(String id, String authorId, String authorName, boolean bot, String createdAt,
                   String editedAt, String content, List<String> blocks, List<Attachment> attachments, String replyToId) {}
    record Messages(List<Message> items, String nextBefore, boolean hasMore) {}
    private record Access(BotResponse bot, UUID owner, Set<String> installations) {}

    List<Ticket> list(String subject, UUID botId, boolean admin) {
        Access access = access(subject, botId, admin);
        var stored=records.list(botId).stream().filter(e->access.installations().contains(e.installationId().toString())).map(e->
            new Ticket(e.channelId(),e.name(),e.state().path("categoryKey").asText(),e.state().path("ownerId").asText(),e.state().path("status").asText(),e.state().path("openedAt").asLong(),e.archived())).toList();
        JsonNode channels;
        try { channels = discord.channels(token(access), access.bot().discordGuildId()); }
        catch(RuntimeException unavailable) {
            if(!stored.isEmpty()) return stored;
            throw unavailable;
        }
        if (!channels.isArray()) throw new StoreValidationException("Discord returned an invalid channel list");
        var result = new ArrayList<Ticket>(stored);
        var registered = new HashSet<String>();
        stored.forEach(t->registered.add(t.channelId()));
        for (JsonNode channel : channels) {
            Ticket ticket = ticket(access, channel);
            if (ticket != null && !registered.contains(ticket.channelId())) result.add(ticket);
        }
        result.sort(Comparator.comparingLong(Ticket::openedAt).reversed().thenComparing(Ticket::channelId));
        return result;
    }
    Messages messages(String subject, UUID botId, boolean admin, String channelId, String before, int limit) {
        id(channelId);
        if (before != null) id(before);
        if (limit < 1 || limit > 100) throw new StoreValidationException("Message limit must be 1–100");
        Access access = access(subject, botId, admin);
        var stored=records.find(botId,channelId).filter(e->access.installations().contains(e.installationId().toString()));
        if(stored.isPresent() && stored.get().archived()) {
            var all=new ArrayList<Message>();
            for(JsonNode item:stored.get().messages()) {
                var message=json.treeToValue(item,Message.class);
                if(before==null||new java.math.BigInteger(message.id()).compareTo(new java.math.BigInteger(before))<0) all.add(message);
            }
            all.sort(Comparator.comparing(m->new java.math.BigInteger(m.id())));
            boolean more=all.size()>limit;
            List<Message> page=all.subList(Math.max(0,all.size()-limit),all.size());
            return new Messages(List.copyOf(page),more?page.getFirst().id():null,more);
        }
        String token=token(access);
        JsonNode channel = discord.channel(token, channelId);
        if (!access.bot().discordGuildId().equals(channel.path("guild_id").asText()) || (stored.isEmpty() && ticket(access, channel) == null))
            throw new StoreNotFoundException("Ticket was not found for this bot");
        JsonNode page = discord.messages(token, channelId, before, limit);
        if (!page.isArray()) throw new StoreValidationException("Discord returned invalid messages");
        var items = new ArrayList<Message>();
        for (JsonNode message : page) items.add(message(message));
        items.sort(Comparator.comparing(item -> new java.math.BigInteger(item.id())));
        return new Messages(items, items.size() == limit ? items.getFirst().id() : null, items.size() == limit);
    }
    private Access access(String subject, UUID botId, boolean admin) {
        var account = users.getActiveAccount(subject);
        UUID owner = account.id();
        if (admin) {
            if (account.role() != AppRole.ADMIN) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            owner = adminBots.findBot(botId).orElseThrow(() -> new StoreNotFoundException("Bot was not found")).ownerUserId();
        }
        BotResponse bot = bots.findOwnedBot(botId, owner).orElseThrow(() -> new StoreNotFoundException("Bot was not found"));
        id(bot.discordGuildId());
        Set<String> installations = new HashSet<>(jdbc.queryForList("""
            SELECT i.id::text FROM private.bot_feature_installations i
            JOIN shop.feature_products p ON p.id=i.feature_product_id
            WHERE i.bot_id=? AND p.code='ticket'
            """, String.class, botId));
        return new Access(bot, owner, installations);
    }
    private String token(Access access) {
        var secret=bots.findBotCredential(access.bot().id(),access.owner(),"DISCORD_TOKEN");
        if(secret==null) throw new StoreValidationException("Discord token is not configured");
        return cipher.decrypt(secret.ciphertext(),secret.nonce(),secret.keyVersion());
    }
    private Ticket ticket(Access access, JsonNode channel) {
        if (channel.path("type").asInt(-1) != 0) return null;
        var marker = MARKER.matcher(channel.path("topic").asText(""));
        if (!marker.matches() || !access.installations().contains(marker.group(1))) return null;
        try {
            JsonNode state = json.readTree(marker.group(2));
            String owner = state.path("ownerId").asText();
            String category = state.path("categoryKey").asText();
            String status = state.path("status").asText();
            if (!owner.matches("[0-9]{15,30}") || !category.matches("[a-z0-9_-]{1,32}")
                    || !Set.of("OPEN", "CLOSING", "CLOSED").contains(status) || state.path("openedAt").asLong() <= 0) return null;
            return new Ticket(channel.path("id").asText(), channel.path("name").asText(), category, owner, status, state.path("openedAt").asLong(), false);
        } catch (Exception invalidTopic) { return null; }
    }
    static Message message(JsonNode source) {
        JsonNode author = source.path("author");
        String name = source.path("member").path("nick").asText("");
        if (name.isBlank()) name = author.path("global_name").asText("");
        if (name.isBlank()) name = author.path("username").asText("Unknown user");
        var blocks = new ArrayList<String>();
        for (JsonNode embed : source.path("embeds")) {
            add(blocks, embed.path("title")); add(blocks, embed.path("description"));
            for (JsonNode field : embed.path("fields")) { add(blocks, field.path("name")); add(blocks, field.path("value")); }
            add(blocks, embed.path("footer").path("text"));
        }
        components(source.path("components"), blocks);
        for (JsonNode sticker : source.path("sticker_items")) blocks.add("Sticker: " + sticker.path("name").asText());
        var attachments = new ArrayList<Attachment>();
        for (JsonNode attachment : source.path("attachments")) {
            String url = attachment.path("url").asText();
            if (attachmentUrl(url)) attachments.add(new Attachment(attachment.path("filename").asText("File"), url));
        }
        return new Message(source.path("id").asText(), author.path("id").asText(), name,
            author.path("bot").asBoolean(), source.path("timestamp").asText(),
            source.path("edited_timestamp").isTextual() ? source.path("edited_timestamp").asText() : null,
            source.path("content").asText(""), blocks, attachments,
            source.path("message_reference").path("message_id").isTextual() ? source.path("message_reference").path("message_id").asText() : null);
    }
    private static void components(JsonNode rows, List<String> blocks) {
        if (!rows.isArray()) return;
        for (JsonNode row : rows) {
            if (row.path("type").asInt() == 10) add(blocks, row.path("content"));
            components(row.path("components"), blocks);
        }
    }
    private static void add(List<String> blocks, JsonNode value) { if (value.isTextual() && !value.asText().isBlank()) blocks.add(value.asText()); }
    static boolean attachmentUrl(String value) {
        try {
            var url = java.net.URI.create(value);
            return "https".equals(url.getScheme()) && Set.of("cdn.discordapp.com", "media.discordapp.net").contains(url.getHost())
                && url.getPath().startsWith("/attachments/") && url.getRawUserInfo() == null;
        } catch (IllegalArgumentException invalid) { return false; }
    }
    private static void id(String value) { if (value == null || !value.matches("[0-9]{15,30}")) throw new StoreValidationException("Invalid Discord ID; configure a Discord server for this bot"); }
}
